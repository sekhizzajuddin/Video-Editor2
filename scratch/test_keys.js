const groqKey = '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';
const geminiKey = 'AQ.Ab8RN6JwMTF_L0nRG4MnB3RrPXRCoZt1XTV3k3tPZlyKBh-XOQ';

async function testGroq() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    if (res.ok) console.log('Groq API Key: VALID');
    else console.log('Groq API Key: INVALID (' + res.status + ') ' + await res.text());
  } catch(e) {
    console.log('Groq Error:', e);
  }
}

async function testGemini() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hello' }] }] })
    });
    if (res.ok) console.log('Gemini API Key (as ?key=): VALID');
    else {
      console.log('Gemini API Key (as ?key=): INVALID (' + res.status + ') ' + await res.text());
      // try as Bearer
      const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hello' }] }] })
      });
      if (res2.ok) console.log('Gemini API Key (as Bearer): VALID');
      else console.log('Gemini API Key (as Bearer): INVALID (' + res2.status + ') ' + await res2.text());
    }
  } catch(e) {
    console.log('Gemini Error:', e);
  }
}

testGroq().then(testGemini);
