const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = dir + '/' + file;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      files.push(name);
    }
  }
  return files;
}

const files = getFiles('src/components');

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    traverse(ast, {
      FunctionDeclaration(path) {
        checkFunction(path, file);
      },
      ArrowFunctionExpression(path) {
        if (path.parent.type === 'VariableDeclarator' && path.parent.id.name.match(/^[A-Z]/)) {
          checkFunction(path, file);
        }
      }
    });
  } catch(e) {
    // skip parse errors
  }
}

function checkFunction(path, file) {
  const compName = path.node.id ? path.node.id.name : (path.parent.id ? path.parent.id.name : 'Unknown');
  if (!compName.match(/^[A-Z]/)) return;
  
  let hasReturn = false;
  
  if (path.node.body.type === 'BlockStatement') {
    for (const stmt of path.node.body.body) {
      if (stmt.type === 'ReturnStatement' || (stmt.type === 'IfStatement' && stmt.consequent.type === 'ReturnStatement') || (stmt.type === 'IfStatement' && stmt.consequent.type === 'BlockStatement' && stmt.consequent.body.some(b => b.type === 'ReturnStatement'))) {
        hasReturn = true;
      }
      
      if (hasReturn && stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee.name && decl.init.callee.name.startsWith('use')) {
            console.log(`Violation in ${file} component ${compName}: Hook ${decl.init.callee.name} called after early return at line ${stmt.loc.start.line}`);
          }
        }
      }
    }
  }
}
