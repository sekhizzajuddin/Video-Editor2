const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

const code = fs.readFileSync('src/components/PropertiesPanel.tsx', 'utf8');
const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  FunctionDeclaration(path) {
    if (path.node.id && path.node.id.name === 'PropertiesPanel') checkFunction(path);
  }
});

function checkFunction(path) {
  let hasReturn = false;
  let returnLine = 0;
  
  if (path.node.body.type === 'BlockStatement') {
    for (const stmt of path.node.body.body) {
      if (stmt.type === 'ReturnStatement') {
        hasReturn = true;
        returnLine = stmt.loc.start.line;
      } else if (stmt.type === 'IfStatement' && stmt.consequent.type === 'ReturnStatement') {
        hasReturn = true;
        returnLine = stmt.loc.start.line;
      } else if (stmt.type === 'IfStatement' && stmt.consequent.type === 'BlockStatement' && stmt.consequent.body.some(b => b.type === 'ReturnStatement')) {
        hasReturn = true;
        returnLine = stmt.loc.start.line;
      }
      
      if (hasReturn && stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee.name && decl.init.callee.name.startsWith('use')) {
            console.log(`Violation: Hook ${decl.init.callee.name} at line ${stmt.loc.start.line} called after early return at line ${returnLine}`);
          }
        }
      }
    }
  }
}
