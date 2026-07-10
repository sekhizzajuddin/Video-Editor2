const fs = require('fs');

async function run() {
  const payloadStr = fs.readFileSync(process.argv[2], 'utf-8');
  const payload = JSON.parse(payloadStr);

  try {
    const res = await fetch('http://127.0.0.1:10086/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      console.error(await res.text());
      process.exit(1);
    }
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
