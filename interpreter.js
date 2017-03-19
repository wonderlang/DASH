#!/usr/bin/env node

//First off, I apologize if the code appears gnarly. My coding style is... interesting.
//I have done my best to make it somewhat more readable. Hope this works for you;
//if not, then just open a Github issue about it.
//TIP: Having a comprehensive syntax highlighter will help a LOT.

//Dependencies
const fs=require('fs'),
fg=require('flags'),
_=require('lodash'),
l=require('lazy.js'),
C=require('js-combinatorics'),
d=require('decimal.js'),
tr=require('traverse'),
P=require('path'),
slp=require('sleep'),
prompt=require('prompt-sync')({sigint:true}),
Exec=require('child_process').execSync,
key=require('keypress'),
XRE=require('xregexp')
eval(''+fs.readFileSync('cm.js'))
eval(''+fs.readFileSync('vs.js'))

//This defines default number behavior
d.config({
  toExpNeg:-9e15,
  toExpPos:9e15,
  crypto:true,
  modulo:d.EUCLID
})

//Parsing command line flags
fg.defineString('f')
fg.defineString('e')
fg.parse()
tk=0
expr=1

//Custom tokens
XRE.addToken(
  /\\e/,
  x=>'\\x1b',
  {scope:'all'}
)
XRE.addToken(
  /\\a/,
  x=>'\\x07',
  {scope:'all'}
)

//Lexer/parser
const parser=require('./wonder.js'),

//Length function
//TODO: figure out how to make this work on ALL infinite lists
len=x=>{
  try{
    return x.body.length()
  }
  catch(e){
    return x.body.size()
  }
},

//Boolean type conversion
tru=x=>(
  {
    type:'bool',
    body:
      !x?
        0
      :x.type=='num'?
        +(x.body!=0)
      :x.type=='str'||x.type=='ls'||x.type=='obj'?
        +!!len(x)
      :x.type=='bool'?
        x.body
      :1
  }
),

//Just a console.log wrapper for debugging
O=x=>(console.log(x),x),

//Utility functions for wrapping raw data in types and converting
//These follow the parser's convention of type wrapping
//All types contain a type header, a body, and possibly f and g properties.
num=x=>({
  type:'num',
  body:
    l(
      isNaN(+x)?
        x.charAt?
          ''+l(x).map(a=>a.codePointAt()).sum()
        :''+len(ls(x))
      :(''+d(''+x))
        .replace(/_/g,'-')
        .replace(/oo/g,'Infinity'))
}),
str=x=>({type:'str',body:l((x+''))}),
ls=x=>({type:'ls',body:l(x).map(I)}),
obj=x=>({type:'obj',body:l(x)}),
vr=(x,y)=>({type:'var',body:x,f:y}),
app=(x,y)=>({type:'app',body:x,f:y}),
pt=(x,y,z)=>({type:'pt',body:x,f:y,rev:z})
def=x=>({type:'def',body:x}),
fn=x=>({type:'fn',body:x}),
a=x=>({type:'a',body:0|x}),
rgx=x=>x.type=='rgx'?x.body:XRE(x.body),
pm=x=>({type:'pm',body:x}),

//Source formatting function, with syntax highlighting
//Should be updated to account for all types/changes to type behaviors
form=x=>
  x.type=='num'?
    `\x1b[33m${
      (''+x.body)
        .replace(/Infinity/g,'oo')
        .replace(/-/g,'_')
    }\x1b[0m`
  :x.type=='fn'?
    `\x1b[34m${x.rev?'^':''}${x.body}\x1b[0m`
  :x.type=='str'?
    `\x1b[32m"${
      (''+x.body)
        .replace(/"/g,'\\"')
        .replace(XRE('(?=\\S|\r)\\pC','g'),a=>`#u{${a.charCodeAt().toString(16)}}`)
    }"\x1b[0m`
  :x.type=='istr'?
    `\x1b[32m"${
      x.body
        .map(a=>
          a.map?
            `\x1b[0m#(${a.map(form)})\x1b[32m`
          :a
            .replace(/"/g,'\\"')
            .replace(XRE('(?=\\S|\r)\\pC','g'),a=>`#u{${a.charCodeAt().toString(16)}}`)
        ).join``
    }"\x1b[0m`
  :x.type=='bool'?
    `\x1b[36m${x.body?'T':'F'}\x1b[0m`
  :x.type=='ls'?
    `[${
      tk?
        x.body.take?
          x.body.take(tk).map(form).join(';')+(x.body.get(tk+1)?';...':'')
        :x.body.map(form).join(';')
      :'ls'
    }]`
  :x.type=='obj'?
    `{${l(x.body).map((a,b)=>'\x1b[32m"'+b+'"\x1b[0m\\'+form(a)).value().join`;`}}`
  :x.type=='def'?
    `\x1b[92m@${form(x.body)}\x1b[0m`
  :x.map?
    `(${x.map(form).join`;`})`
  :x.type=='pt'?
      `\x1b[34m${x.rev?'^':''}${x.body}\x1b[0m `+form(x.f)
  :x.type=='a'?
    `\x1b[34m#${x.body}\x1b[0m`
  :x.type=='ref'?
    `\x1b[34m#\x1b[0m(${form(x.body)})`
  :x.type=='app'?
    form(x.body)+' '+form(x.f)
  :x.type=='var'?
    form(x.body)+'\\'+form(x.f)
  :x.type=='cond'?
    `[${form(x.body)}?${form(x.f)}?${form(x.g)}]`
  :x.type=='rgx'?
    `\x1b[37m\`${x.body.source}\`${x.body.flags}\x1b[0m`
  :x.type=='ev'?
    `(${x.body.map(form).join`;`})${form(x.f)}\\${form(x.g)}`
  :x.type=='pm'?
    `.{${
      x.body.map(a=>a[0]!='@'&&form(a[0])+'\\'+form(a[1])).filter(a=>a).join`;`
    };${form(x.body.find(a=>a[0]=='@')[1])}}`
  :error('failed to format JSON\n'+JSON.stringify(x),halt),

//String formatting function
sform=x=>
  x.type=='num'?
    (''+x.body).replace(/Infinity/g,'oo').replace(/-/g,'_')
  :x.type=='fn'||x.type=='str'||x.type=='a'?
    ''+x.body
  :x.type=='istr'?
    x.body.map(a=>a.map?'#(expr)':a).join``
  :x.type=='ref'?
    sform(x.body)
  :x.type=='bool'?
    x.body?'T':'F'
  :x.type=='ls'?
    `[ls]`
  :x.type=='obj'?
    `{obj ${x.body.keys().size()}}`
  :x.type=='def'?
    `@(expr)`
  :x.map?
    `(expr)`
  :x.type=='app'?
    sform(x.body)+' '+sform(x.f)
  :x.type=='pt'?
    x.body+' '+sform(x.f)
  :x.type=='cond'?
    '[cond]'
  :x.type=='rgx'?
    '`rgx`'
  :x.type=='ev'?
    `(ev ${sform(x.f)} ${sform(x.g)})`
  :x.type=='pm'?
    `{pm}`
  :error('failed to format JSON\n'+JSON.stringify(x),halt),

//Package reading function, reads directly from the wpm folder in the CWD.
pkg=x=>{
  try{
    f=fs.readFileSync((`wpm/${x}/`+fs.readFileSync(`wpm/${x}/pkg`)).replace(/\s/g,''))+''
  }
  catch(e){
    error(`failed to read package "${x}"\n`,halt)
  }
  return I(parser.parse(f))
}

//error message displaying
const error=(e,f)=>{
  console.log('\x1b[31mERROR:\x1b[0m '+e)
  f&&process.exit()
},

//getting error type
ERR=e=>
  e.message.match`\\[DecimalError\\]`?
    e.message.match(`Invalid argument`)
    &&'invalid argument passed to '+(e.stack.match`cm\\.([^ \\n;0-9".[\\]\\(){}@#TF?]+) `||[,'number conversion'])[1]
  :e.message.match`Maximum call stack size exceeded`?
    'too much recursion'
  :e.stack.match`peg\\$buildStructuredError`?
    'failed to parse\n'+e.message
  :e.stack.match`Command failed`?
    `failed to execute "${e.stack.match`Command failed: (.+)`[1]}"`
  :e.stack.match`Backreference to undefined`?
    `backreference to ${e.stack.match`Backreference to undefined group (.+)`[1]} not found`
  :'js error -> '+e.stack,

//WARNING: The code following this comment will be quite messy. Good luck!

//de Bruijn indices substitution
ua=(x,y)=>(X=tr(x),X.map(function(a){
  a.type=='a'&&(
    a.body==(D=this.path.filter(($,i,j)=>(gX=X.get(j.slice(0,i+1)))&&gX.type=='def').length)?
      this.update(
        tr(y).map(function(b){
          b.type=='a'&&b.body>this.path.filter(($,i,j)=>(gX=X.get(j.slice(0,i+1)))&&gX.type=='def').length&&this.update(
            (b.body+=D,b)
          )
        })
      )
    :a.body>D?(a.body--,a):a
  )
})),

//substitution inside evaluation blocks
Ua=(x,y,z)=>tr(x).map(function(a){
  a.type=='ev'&&a.f.body==y.body?
    this.update(Ua(I(a),y,z))
  :(a.type=='fn'||a.type=='ref')&&a.body==y.body&&this.update(z)
}),

//the core evaluation function
I=x=>
  !x||(x.type=='num'&&x.body=='NaN')||(x.pop&&!x.length)?
    tru(0)
  :x.type=='cond'?
    tru(I(x.body)).body?I(x.f):I(x.g)
  :x.type=='ev'?
    I(Ua(x.body,x.f,x.g))
  :x.map?
    (X=x.map(a=>I(a)))[X.length-1]
  :x.type=='ls'?
    ls(x.body)
  :x.type=='obj'?
    obj(x.body)
  :x.type=='str'?
    str(x.body)
  :x.type=='istr'?
    str(
      x.body
        .map(a=>a.map?sform(I(a)):a)
        .join``
        .replace(
          /(?:([^#])#|^#)u([\da-f]{4})/ig,
          (a,b,c)=>(b||'')+String.fromCodePoint(`0x${c}`)
        )
        .replace(
          /(?:([^#])#|^#)u{([\da-f]{0,6})}?/ig,
          (a,b,c)=>(b||'')+String.fromCodePoint(`0x${c}`)
        )
        .replace(/(?:([^#])#|^#)n/ig,'$1\n')
        .replace(/(?:([^#])#|^#)r/ig,'$1\r')
        .replace(/(?:([^#])#|^#)t/ig,'$1\t')
        .replace(/(?:([^#])#|^#)v/ig,'$1\v')
        .replace(/(?:([^#])#|^#)e/ig,'$1\x1b')
        .replace(/(?:([^#])#|^#)a/ig,'$1\x07')
    )
  :x.type=='num'?
    num(x.body)
  :x.type=='var'?
    (vs[x.body.body]=I(x.f))
  :x.type=='ref'?
    I(x.body)
  :x.type=='fn'&&vs[x.body]?
    vs[x.body].call?
      vs[x.body]()
    :vs[x.body]
  :x.type=='app'?
    (z=I(x.body)).type=='fn'?
      cm[z.body]?
        cm[z.body].length>1?
          pt(z.body,I(x.f),z.rev)
        :I(cm[z.body](I(x.f)))
      :error(`undefined function "${z.body}"`,halt)
    :z.type=='def'?
      I(ua(z,x.f).body)
    :z.type=='pt'?
      z.rev?cm[I(z).body](I(x.f),z.f):cm[I(z).body](z.f,I(x.f))
    :z.type=='pm'?
      I(app(
        (X=z.body.find(a=>!a[0].type),Y=z.body.find(a=>a[0].type&&cm.eq(a[0],I(x.f)).body))?
          Y[1]
        :X[1],
      I(x.f)))
    :z.type=='ls'||z.type=='obj'?
      cm.get(I(x.f),z)
    :z.type=='rgx'?
      cm.mstr(z,I(x.f))
    :z
  :x

halt=1

//when module is called by require
//not sure if needed, will keep in case
if(require.main!=module){
  module.exports=this
}

//reading from file with --f
else if(F=fg.get('f')){
  try{
    const code=fs.readFileSync(F)+'',
    ps=parser.parse(code)
    out=ps&&ps.length?I(ps):[]
    expr&&console.log('\n'+form(out))
    console.log('')
  }catch(e){
    error(ERR(e),halt)
  }
}

//reading from string with --e
else if(E=fg.get('e')){
  try{
    ps=parser.parse(E)
    out=ps&&ps.length?I(ps):[]
    expr&&console.log('\n'+form(out))
  }catch(e){
    error(ERR(e),halt)
  }
}

//REPL when no flags read
else{
  logo=fs.readFileSync(__dirname+'/wonder.txt')+''
  pkg=fs.readFileSync(__dirname+'/package.json')+''
  halt=0

  //this messy code displays the logo/REPL header
  console.log(`\x1b[36m\x1b[1m${logo}\x1b[0m\n\n\x1b[93m\x1b[1mv${JSON.parse(pkg).version}\x1b[21m\n\x1b[2mMade with love under the MIT License.\x1b[0m\n\n`)

  //keypress init
  key(process.stdin)
  ow=x=>(process.stdout.clearLine(),process.stdout.cursorTo(0),process.stdout.write(x))
  Prompt=require('prompt-sync')({
    history:require('prompt-sync-history')(),
    sigint:true
  })
  process.stdin.on('keypress',(x,y)=>{
    y&&ow(
      y.name=='up'?
        ow('wonder > '+(Prompt.history.prev()||''))
      :y.name=='down'?
        ow('wonder > '+(Prompt.history.next()||''))
      :0
    )
  })

  //REPL time!
  for(;;){
    p=Prompt('wonder > ')
    Prompt.history.save()
    try{
      console.log('\n'+form(I(parser.parse(p))))
    }catch(e){
      error(ERR(e,halt))
    }
  }
}
