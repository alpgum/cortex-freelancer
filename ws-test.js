const WebSocket = require('ws');

console.log('🚀 Testing WebSocket bridge...');
const ws = new WebSocket('ws://localhost:3850/ws/chat');

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  
  ws.send(JSON.stringify({
    type: 'chat', 
    message: 'I need help writing a proposal for web development project',
    requestId: 'test-001'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'connected') {
    console.log('🔗 Connected:', msg);
  } else if (msg.type === 'stream_start') {
    console.log('📡 Stream starting...');
  } else if (msg.type === 'stream_chunk') {
    process.stdout.write(msg.chunk);
  } else if (msg.type === 'stream_end') {
    console.log('\n✅ Final response:', msg.reply.substring(0, 100) + '...');
    console.log('🎉 TEST SUCCESS!');
    ws.close();
    process.exit(0);
  } else if (msg.type === 'error') {
    console.error('❌ Error:', msg.error);
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Test timeout');
  process.exit(1);
}, 60000);
