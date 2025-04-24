import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import './App.css';

// Definição de tipos para TypeScript
interface TranslationResponse {
  original: string;
  traduzido: string;
  error?: string;
}

function App() {
  const [videoId, setVideoId] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [captions, setCaptions] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [showDubbing, setShowDubbing] = useState<boolean>(true);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<any>(null);
  
  // Extrair ID do vídeo do YouTube da URL
  const extractVideoId = (url: string): string => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : '';
  };

  // Inicializar WebSocket
  const initWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001/traducao');
    
    ws.onopen = () => {
      console.log('Conectado ao servidor WebSocket');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data: TranslationResponse = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
        } else {
          setCaptions(data.traduzido);
          
          // Síntese de voz para dublagem
          if (showDubbing) {
            speakText(data.traduzido);
          }
        }
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('Desconectado do servidor WebSocket');
      setIsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('Erro WebSocket:', error);
      setError('Erro de conexão com o servidor');
    };
    
    wsRef.current = ws;
  };

  // Inicializar reconhecimento de voz
  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Reconhecimento de voz não suportado neste navegador');
      return;
    }
    
    // @ts-ignore - Ignorando erro de tipo para SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';
    
    recognitionInstance.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          console.log('Texto reconhecido:', transcript);
          
          // Enviar texto para o servidor WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(transcript);
          }
        }
      }
    };
    
    recognitionInstance.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error);
      setError(`Erro no reconhecimento de voz: ${event.error}`);
    };
    
    setRecognition(recognitionInstance);
  };

  // Função para síntese de voz (dublagem)
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setError('Síntese de voz não suportada neste navegador');
      return;
    }
    
    // Parar qualquer fala anterior
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Iniciar tradução
  const startTranslation = () => {
    if (!videoId) {
      setError('Por favor, insira uma URL válida do YouTube');
      return;
    }
    
    if (!recognition) {
      initSpeechRecognition();
    }
    
    if (!wsRef.current) {
      initWebSocket();
    }
    
    setIsTranslating(true);
    
    // Iniciar reconhecimento de voz
    if (recognition) {
      try {
        recognition.start();
      } catch (err) {
        console.error('Erro ao iniciar reconhecimento:', err);
      }
    }
  };

  // Parar tradução
  const stopTranslation = () => {
    setIsTranslating(false);
    
    if (recognition) {
      recognition.stop();
    }
    
    // Parar síntese de voz
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setCaptions('');
  };

  // Processar URL do YouTube
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(inputUrl);
    if (id) {
      setVideoId(id);
      setError('');
    } else {
      setError('URL do YouTube inválida');
    }
  };

  // Opções para o player do YouTube
  const opts = {
    height: '390',
    width: '640',
    playerVars: {
      autoplay: 1,
    },
  };

  // Manipular eventos do player do YouTube
  const onReady = (event: any) => {
    playerRef.current = event.target;
  };

  // Limpar recursos ao desmontar o componente
  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [recognition]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tradutor de Livestream</h1>
      </header>
      
      <main className="App-main">
        <section className="url-section">
          <form onSubmit={handleUrlSubmit}>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Cole a URL do YouTube aqui"
              className="url-input"
            />
            <button type="submit" className="url-button">Carregar Vídeo</button>
          </form>
        </section>
        
        {error && <div className="error-message">{error}</div>}
        
        {videoId && (
          <section className="video-section">
            <YouTube
              videoId={videoId}
              opts={opts}
              onReady={onReady}
              className="youtube-player"
            />
            
            <div className="controls">
              <button
                onClick={isTranslating ? stopTranslation : startTranslation}
                className={`control-button ${isTranslating ? 'stop' : 'start'}`}
              >
                {isTranslating ? 'Parar Tradução' : 'Iniciar Tradução'}
              </button>
              
              <div className="options">
                <label>
                  <input
                    type="checkbox"
                    checked={showCaptions}
                    onChange={() => setShowCaptions(!showCaptions)}
                  />
                  Mostrar Legendas
                </label>
                
                <label>
                  <input
                    type="checkbox"
                    checked={showDubbing}
                    onChange={() => setShowDubbing(!showDubbing)}
                  />
                  Ativar Dublagem
                </label>
              </div>
            </div>
            
            {isTranslating && showCaptions && (
              <div className="captions">
                {captions || 'Aguardando fala para traduzir...'}
              </div>
            )}
          </section>
        )}
        
        <section className="status-section">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Conectado ao servidor' : 'Desconectado do servidor'}
          </div>
          
          {isTranslating && (
            <div className="translation-status">
              {isSpeaking ? 'Reproduzindo áudio traduzido...' : 'Aguardando fala...'}
            </div>
          )}
        </section>
      </main>
      
      <footer className="App-footer">
        <p>Tradutor de Livestream - Versão Protótipo</p>
      </footer>
    </div>
  );
}

export default App;
