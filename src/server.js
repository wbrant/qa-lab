'use strict';
const { createApp } = require('./app');

const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, { worker: true }).then(() => {
  const active = [...app.state.bugs].join(', ') || 'none';
  console.log(`SlotKit lab running at http://127.0.0.1:${port}  (active bugs: ${active})`);
});
