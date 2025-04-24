const fastify = require('fastify')({ logger: true });
const { Translate } = require('@google-cloud/translate').v2;

// Registrar plugins
fastify.register(require('@fastify/cors'), {
  origin: '*'
});

fastify.register(require('@fastify/websocket'));

// Configuração do Google Translate
// Nota: Em produção, você precisaria configurar credenciais adequadas
// Para este protótipo, usaremos uma abordagem simplificada
const translate = new Translate({
  projectId: 'seu-projeto-id',
  // Em produção, você precisaria configurar credenciais adequadas
  // keyFilename: '/path/to/key.json',
});

// Rota para verificar se o servidor está funcionando
fastify.get('/', async (request, reply) => {
  return { status: 'online', message: 'Servidor de tradução está funcionando' };
});

// Configuração do WebSocket para tradução em tempo real
fastify.register(async function (fastify) {
  fastify.get('/traducao', { websocket: true }, (connection, req) => {
    connection.socket.on('message', async (message) => {
      try {
        const textoOriginal = message.toString();
        console.log(`Texto recebido para tradução: ${textoOriginal}`);
        
        // Traduzir o texto para português
        // Nota: Em um ambiente de produção, você precisaria configurar credenciais adequadas
        // Para este protótipo, simularemos a tradução
        let textoTraduzido = textoOriginal;
        
        try {
          // Tentar usar a API de tradução se configurada
          const [translation] = await translate.translate(textoOriginal, 'pt-BR');
          textoTraduzido = translation;
        } catch (error) {
          console.error('Erro na tradução:', error);
          // Simulação básica de tradução para demonstração
          textoTraduzido = `[Traduzido] ${textoOriginal}`;
        }
        
        // Enviar o texto traduzido de volta para o cliente
        connection.socket.send(JSON.stringify({
          original: textoOriginal,
          traduzido: textoTraduzido
        }));
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
        connection.socket.send(JSON.stringify({
          error: 'Erro ao processar a tradução'
        }));
      }
    });
  });
});

// Iniciar o servidor
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log(`Servidor rodando em ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
