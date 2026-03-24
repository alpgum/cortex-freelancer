const WebSocket = require('ws');

console.log('🎯 CORTEX FREELANCER TEST - Yorgun Alp için! 😄');
const ws = new WebSocket('ws://localhost:3850/ws/chat');

ws.on('open', () => {
  console.log('✅ Bağlandı!');
  
  ws.send(JSON.stringify({
    type: 'chat',
    message: 'Merhaba! Freelancer olarak nasıl daha çok para kazanabilirim? Rate stratejimi geliştirmek istiyorum.',
    requestId: 'test-alp-yorgun'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'stream_chunk') {
    process.stdout.write(msg.chunk);
  } else if (msg.type === 'stream_end') {
    console.log('\n\n🎉 TEST TAMAM - Cortex coaching received!');
    ws.close();
    process.exit(0);
  } else if (msg.type === 'error') {
    console.error('❌', msg.error);
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('⏰ Timeout');
  process.exit(1);
}, 45000);
