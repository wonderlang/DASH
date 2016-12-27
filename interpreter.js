#!/usr/bin/env node

//First off, I apologize if the code appears gnarly. My coding style is... interesting.
//I have done my best to make it somewhat more readable. Hope this works for you;
//if not, then just open a Github issue about it.
//TIP: Having a comprehensive syntax highlighter will help a LOT.

//Dependencies
const fs=require('fs'),
fg=require('flags'),
peg=require('pegjs'),
_=require('lodash'),
l=require('lazy.js'),
d=require('decimal.js'),
tr=require('traverse'),
P=require('path'),
slp=require('sleep'),
prompt=require('prompt-sync')({sigint:true}),
Exec=require('child_process').execSync,
key=require('keypress'),
XRE=require('xregexp')

//This defines default number behavior
d.config({
  toExpNeg:-9e15,
  toExpPos:9e15,
  crypto:true,
  modulo:d.EUCLID
})

//Parsing command line flags
fg.defineBoolean('expr',true)
fg.defineString('f')
fg.defineString('e')
fg.defineNumber('tk',1e3)
fg.parse()

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
const lex=fs.readFileSync(__dirname+'/wonder.pegjs')+'',
parser=peg.generate(lex),

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

str=x=>({
  type:'str',
  body:l((x+'')
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
}),

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
    `\x1b[34m${x.body}\x1b[0m`
  :x.type=='str'?
    `\x1b[32m"${
      (''+x.body)
        .replace(/"/g,'\\"')
        .replace(XRE('(?=\\S|\r)\\pC','g'),a=>`#u{${a.charCodeAt().toString(16)}}`)
    }"\x1b[0m`
  :x.type=='bool'?
    `\x1b[36m${x.body?'T':'F'}\x1b[0m`
  :x.type=='ls'?
    `[${
      x.body.take?
        x.body.take(fg.get('tk')).map(form).join(';')+(x.body.get(fg.get('tk')+1)?';...':'')
      :x.body.map(form).join('')
    }]`
  :x.type=='obj'?
    `{${l(x.body).map((a,b)=>'\x1b[32m"'+b+'"\x1b[0m\\'+form(a)).value().join`;`}}`
  :x.type=='def'?
    `\x1b[92m@${form(x.body)}\x1b[0m`
  :x.map?
    `(${x.map(form).join`;`})`
  :x.type=='pt'?
    `\x1b[34m${x.body}\x1b[0m `+form(x.f)
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
},

//STDLIB is called cm
//This will be one helluva challenge to read, I'm sure. Sorry!
//All cm functions are either unary or binary; no more, no less.
//Note that almost all of these functions work with the properties of the types.
//If you want to add other functions, be sure to at least *try* to notice some
//of the structures that I use (esp. for type checking/conversion).
//More info can be found on the Github wiki's page on cm functions.
cm={
  //input
  rl:x=>str(prompt('',0)),
  rf:x=>str(fs.readFileSync(x.body+'')+''),

  //output
  //Using the form and sform functions are important here
  os:x=>(process.stdout.write(form(x).replace(/\x1b\[\d+m/g,'')),x),
  ol:x=>(process.stdout.write(sform(x)),x),
  oN:x=>(process.stdout.write(sform(x)+'\n'),x),
  wf:(x,y)=>(fs.writeFileSync(''+x.body,sform(y)),y),

  //num
  //Use num(x.body).body for converting to number
  num:x=>num(x.body),
  //charcode
  tc:x=>ls(x.body.map(a=>num(a.codePointAt()))),
  fc:x=>str(
    x.type=='ls'?
      x.body.map(a=>cm.fc(I(a)).body).join('')
    :String.fromCodePoint(0|num(x.body).body)
  ),
  //base
  hx:x=>str(d(''+num(x.body).body).toHexadecimal()),
  bn:x=>str(d(''+num(x.body).body).toBinary()),
  ot:x=>str(d(''+num(x.body).body).toOctal()),
  //precision and rounding
  E:x=>(d.config({precision:0|num(x.body).body}),x),
  rnd:x=>num(0|num(x.body).body?d.random(0|num(x.body).body):''+0|d.random()*2),
  flr:x=>num(d.floor(''+num(x.body).body)),
  trunc:x=>num(d.trunc(''+num(x.body).body)),
  round:x=>num(d.round(''+num(x.body).body)),
  ceil:x=>num(d.ceil(''+num(x.body).body)),
  //sign
  sign:x=>num(d.sign(''+num(x.body).body)),
  abs:x=>num(d.abs(''+num(x.body).body)),
  neg:x=>num(d(num(x.body).body+'').neg()),
  //number comparison
  cmp:(x,y)=>num(d(''+num(x.body).body).cmp(''+num(y.body).body)),
  max:x=>num(d.max(...x.body.map(a=>''+num(a.body).body).value())),
  min:x=>num(d.min(...x.body.map(a=>''+num(a.body).body).value())),
  //arithmetic
  add:(x,y)=>num(d.add(''+num(x.body).body,''+num(y.body).body)),
  sum:x=>num(x.body.map(a=>x.body.charAt?str(a):a).reduce((a,b)=>d.add(a,''+num(b.body).body),0)),
  sub:(x,y)=>num(d.sub(''+num(x.body).body,''+num(y.body).body)),
  mul:(x,y)=>num(d.mul(''+num(x.body).body,''+num(y.body).body)),
  prod:x=>num(x.body.map(a=>x.body.charAt?str(a):a).reduce((a,b)=>d.mul(a,''+num(b.body).body),1)),
  div:(x,y)=>num(d.div(''+num(x.body).body,''+num(y.body).body)),
  mod:(x,y)=>num(d.mod(''+num(x.body).body,''+num(y.body).body)),
  pow:(x,y)=>
    (X=d.pow(''+num(x.body).body,''+num(y.body).body))+''=='NaN'?
      tru(0)
    :num(X),
  exp:x=>num(d.exp(''+num(x.body).body)),
  hypot:(x,y)=>num(d.hypot(''+num(x.body).body,''+num(y.body).body)),
  fac:x=>ls(
    _.range(1,Math.abs(X=0|num(x.body).body)/2+1|0)
      .filter(a=>!(X%a))
      .map(a=>num(X<0?-a:a))
      .concat(num(X))
  ),
  gcd:(x,y)=>num((g=(m,n)=>m>n?g(m-n,n):m<n?g(m,n-m):m)(Math.abs(0|x.body),Math.abs(0|y.body))),
  lcm:(x,y)=>(X=0|x.body,Y=0|y.body,X*Y/cm.gcd(x,y)),
  //logarithms
  log:(x,y)=>num(d.log(''+num(x.body).body,''+num(y.body).body)),
  ln:x=>num(d.ln(''+num(x.body).body)),
  ltn:x=>num(d.log10(''+num(x.body).body)),
  //trig
  sin:x=>num(d.sin(''+num(x.body).body)),
  sinh:x=>num(d.sinh(''+num(x.body).body)),
  asin:x=>num(d.asin(''+num(x.body).body)),
  asinh:x=>num(d.asinh(''+num(x.body).body)),
  cos:x=>num(d.cos(''+num(x.body).body)),
  cosh:(x,y)=>num(d.cosh(''+num(x.body).body)),
  acos:x=>num(d.acos(''+num(x.body).body)),
  acosh:x=>num(d.acosh(''+num(x.body).body)),
  tan:x=>num(d.tan(''+num(x.body).body)),
  tanh:x=>num(d.tanh(''+num(x.body).body)),
  atan:x=>num(d.atan(''+num(x.body).body)),
  atanh:x=>num(d.atanh(''+num(x.body).body)),
  atant:(x,y)=>num(d.atan2(''+num(x.body).body,''+num(y.body).body)),

  //bool
  //The tru function is important here
  bool:tru,
  tru:x=>tru(tru(x).body||x.type=='num'||x.type=='str'||x.type=='ls'||x.type=='obj'),
  //comparisons
  eq:(x,y)=>tru(
    form(x.type=='obj'?obj(x.body.sort().toObject()):x)==form(y.type=='obj'?obj(y.body.sort().toObject()):y)
    ||(x.body.charAt&&y.body.charAt&&''+num(x.body).body==''+num(y.body).body)
  ),
  neq:(x,y)=>cm.not(cm.eq(x,y)),
  gt:(x,y)=>tru(+d(''+num(x.body).body).cmp(''+num(y.body).body)==1),
  lt:(x,y)=>tru(+d(''+num(x.body).body).cmp(''+num(y.body).body)==-1),
  lteq:(x,y)=>tru(+d(''+num(x.body).body).lte(''+num(y.body).body)),
  gteq:(x,y)=>tru(+d(''+num(x.body).body).gte(''+num(y.body).body)),
  //boolean logic
  and:(x,y)=>tru(tru(x).body&&tru(y).body),
  or:(x,y)=>tru(tru(x).body||tru(y).body),
  xor:(x,y)=>tru(+(tru(x).body!=tru(y).body)),
  not:x=>tru(+!tru(x).body),

  //map family
  //y.body.charAt?str(a):a converts any iterable type to a list
  map:(x,y)=>ls(y.body.map(a=>I(app(x,y.body.charAt?str(a):a)))),
  fold:(x,y)=>y.body.reduce((a,b)=>I(app(app(x.body.get(0),b),y.body.charAt?str(a):a)),x.body.get(1)),
  foldr:(x,y)=>y.body.reduceRight((a,b)=>I(app(app(x.body.get(0),b),y.body.charAt?str(a):a)),x.body.get(1)),
  tkwl:(x,y)=>ls(y.body.takeWhile(a=>tru(I(app(x,y.body.charAt?str(a):a))).body)),
  drwl:(x,y)=>ls(y.body.dropWhile(a=>tru(I(app(x,y.body.charAt?str(a):a))).body)),
  fltr:(x,y)=>ls(y.body.filter(a=>tru(I(app(x,y.body.charAt?str(a):a))).body)),
  find:(x,y)=>y.body.find(a=>tru(I(app(x,y.body.charAt?str(a):a))).body),
  findi:(x,y)=>y.body.map((a,b)=>tru(I(app(x,y.body.charAt?str(a):a))).body?num(b):0).find(a=>a)||bool(0),
  every:(x,y)=>tru(y.body.every(a=>tru(I(app(x,y.body.charAt?str(a):a))).body)),
  some:(x,y)=>tru(y.body.some(a=>tru(I(app(x,y.body.charAt?str(a):a))).body)),

  //array getting, setting, manipulating
  len:x=>num(len(x)),
  tk:(x,y)=>ls(y.body.take(0|num(x.body).body).map(a=>a.charAt?str(a):a)),
  dp:(x,y)=>ls(y.body.drop(0|num(x.body).body).map(a=>a.charAt?str(a):a)),
  get:(x,y)=>I((
    y.type=='pm'?
      app(y,x)
    :y.type=='obj'?
      y.body.get(''+x.body)
    :y.body.map(a=>a.charAt?str(a):a).get(0|d.mod(0|num(x.body).body,len(y)))
  )||tru(0)),
  iget:(x,y)=>I((
    y.type=='obj'?
      y.body.get(''+x.body)
    :y.body.map(a=>a.charAt?str(a):a).get(0|num(x.body).body)
  )||tru(0)),
  set:(x,y)=>
    y.type=='pm'?
      pm(
        y.body.find(a=>a[0]!='@'&&cm.eq(x.body.get(0),a[0]).body)?
          y.body.map(a=>a[0]!='@'&&cm.eq(x.body.get(0),a[0]).body?[x.body.get(0),x.body.get(1)]:a)
        :y.body.concat([[x.body.get(0),x.body.get(1)]])
      )
    :y.type=='obj'?
      (X={},X[x.body.get(0).body]=x.body.get(1),obj(y.body.assign(X)))
    :ls(y.body.map(a=>y.type=='str'?str(a):a).map((a,b)=>b==''+d.mod(''+x.body.get(0).body,len(y))?x.body.get(1):a)),
  iset:(x,y)=>
    y.type=='pm'?
      pm(y.body.concat([[x.body.get(0),x.body.get(1)]]))
    :y.type=='obj'?
      (X={},X[x.body.get(0).body]=x.body.get(1),obj(y.body.assign(X)))
    :ls(y.body.map(a=>y.type=='str'?str(a):a).map((a,b)=>b==''+x.body.get(0).body?x.body.get(1):a)),
  ins:(x,y)=>
    y.type=='obj'||y.type=='pm'?
      cm.set(x,y)
    :(
      Y=y.body.map(a=>y.type=='str'?str(a):a),
      ls(Y.take(d.mod(0|x.body.get(0).body,len(y))).concat(x.body.get(1),
      Y.last(len(y)-d.mod(''+x.body.get(0).body,len(y)))))
    ),
  iins:(x,y)=>
    y.type=='obj'||y.type=='pm'?
      cm.set(x,y)
    :(
      Y=y.body.map(a=>y.type=='str'?str(a):a),
      ls(Y.take(0|x.body.get(0).body).concat(x.body.get(1),
      Y.drop(0|x.body.get(0).body)))
    ),
  con:(x,y)=>
    x.type!='ls'?
      x.type!='obj'?
        str(sform(x)+sform(y))
      :obj(Object.assign(x.body.value(),y.body.map(a=>y.body.charAt?str(a):a).value()))
    :cm.flat(ls([x,y])),
  iO:(x,y)=>ls(y.body.map((a,b)=>cm.eq(y.body.charAt?str(a):a,x).body?num(b):0).filter(a=>a)),
  fiO:(x,y)=>y.body.map((a,b)=>cm.eq(y.body.charAt?str(a):a,x).body?num(b):0).find(a=>a)||bool(0),
  rev:x=>ls(x.body.map(a=>x.body.charAt?str(a):a).reverse()),
  shuf:x=>ls((x.body.charAt?x.body.map(str):x.body).shuffle()),
  sort:(x,y)=>ls(y.body.sortBy(a=>num(I(app(x,y.body.charAt?str(a):a)).body).body)),

  //generating sequences
  rng:(x,y)=>([X,Y]=[+x.body,+y.body],ls(l.generate(a=>num(d.add(a,''+num(x.body).body))).take(Y-X))),
  gen:x=>ls(l.generate(a=>app(x,num(a)),1/0)),
  genc:(x,y)=>ls(l.generate(a=>[...Array(a)].reduce(i=>I(app(x,i)),y),1/0)),
  rpt:x=>ls(l.repeat(x,1/0)),
  cyc:x=>ls(l.generate(a=>cm.get(num(a),x),1/0)),

  //set operations
  unq:x=>ls(x.body.map(i=>i.charAt?str(i):i).uniq(a=>form(a.type=='obj'?obj(a.body.sort().toObject()):a))),
  inx:(x,y)=>(
    [X,Y]=[x.body.map(a=>x.body.charAt?str(a):a),y.body.map(a=>y.body.charAt?str(a):a)],
    ls(X.filter(a=>Y.find(b=>cm.eq(a,b).body)))
  ),
  uni:(x,y)=>cm.unq(cm.flat(ls([ls(x.body.map(a=>a.charAt?str(a):a)),ls(y.body.map(a=>a.charAt?str(a):a))]))),
  dff:(x,y)=>(
    [X,Y]=[x.body.map(a=>x.body.charAt?str(a):a),y.body.map(a=>y.body.charAt?str(a):a)],
    A=X.concat(Y),
    ls(X.filter(a=>
      !Y.find(b=>cm.eq(a,b).body)
    ))
  ),

  //nested lists
  chunk:(x,y)=>ls(
    y.body.charAt?
      y.body.chunk(0|num(x.body).body).map(a=>str(a.join``))
    :y.body.chunk(0|num(x.body).body).map(ls)
  ),
  tsp:x=>ls(
    x.body.first().body.map((a,i)=>ls(
        x.body.map(b=>b.body.get(i)).map(b=>b?b.charAt?str(b):b:tru(0))
    ))
  ),
  flat:x=>ls(x.body.map(a=>x.body.charAt?str(a):a.type=='ls'?a.body:a).flatten()),
  zip:(x,y)=>cm.map(I(app(fn('sS'),x)),cm.tsp(y)),
  cns:(x,y)=>ls(y.body.map(a=>y.body.charAt?str(a):a).consecutive(0|num(x.body).body).map(ls)),

  //obj
  ind:x=>cm.tsp(I(ls(x.type=='obj'?[ls(x.body.keys().map(a=>str(''+a))),ls(x.body.values())]:[cm.rng(num(0),num(len(x))),x]))),
  key:x=>cm.tsp(cm.ind(x)).body.first(),
  val:x=>cm.tsp(cm.ind(x)).body.last(),
  pk:(x,y)=>obj(y.body.pick(x.body.map(a=>a.body).value())),
  om:(x,y)=>obj(y.body.omit(x.body.map(a=>a.body).value())),
  obj:x=>obj(x.body.map(a=>[sform((A=a.body.get(0)).charAt?str(A):A),(B=a.body.get(1)).charAt?str(B):B]).toObject()),
  obl:x=>cm.obj(cm.tsp(ls([cm.key(x),x]))),

  //str
  str:x=>str(sform(x)),
  src:x=>str(form(x).replace(/\x1b\[\d+m/g,'')),
  join:(x,y)=>str(y.body.map(sform).join(sform(x))),
  lc:x=>str((''+x.body).toLowerCase()),
  uc:x=>str((''+x.body).toUpperCase()),

  //rgx
  R:(x,y)=>({type:'rgx',body:XRE(''+x.body,''+y.body)}),
  //matching
  mstr:(x,y)=>obj(l(Object.assign({},XRE.match(''+y.body,rgx(x))||[])).map((a,b)=>[b,str(a)]).toObject()),
  xstr:(x,y)=>obj(l(Object.assign({},XRE.exec(''+y.body,rgx(x))||[])).map((a,b)=>[b,(a.toFixed?num:str)(a)]).toObject()),
  sstr:(x,y)=>num((XRE.exec(''+y.body,rgx(x))||[]).index||bool(0)),
  gstr:(x,y)=>ls(y.body.split('\n').filter(a=>XRE.match(a,rgx(x))).map(str)),
  Gstr:(x,y)=>ls(y.body.split('\n').reject(a=>XRE.match(a,rgx(x))).map(str)),
  //replacing
  split:(x,y)=>ls(XRE.split(''+y.body,rgx(x)).map(str)),
  rstr:(x,y)=>str(
    XRE.replace(
      y.body+'',
      rgx(x.body.get(0)),
      (x.body.get(1)||str('')).body.charAt&&(x.body.get(1)||str('')).type!='fn'&&(x.body.get(1)||str('')).type!='pt'?
        ''+(x.body.get(1)||str('')).body
      :(a,...b)=>sform(I(app(x.body.get(1),I([str(a)].concat(b.slice(0,-2).map(i=>str(i||'')))))))
    )
  ),
  Rstr:(x,y)=>
    tru(cm.mstr(x.body.get(0),y)).body?
      cm.Rstr(x,cm.rstr(x,y))
    :y,

  //flow
  type:x=>str(x.type),
  var:(x,y)=>vs[x.body]?vs[x.body]:(vs[x.body]=y),
  while:(x,y)=>([X,Y]=[x.body.get(0),x.body.get(1)],tru(I(app(X,y))).body?cm.while(x,I(app(Y,y))):y),
  pkg:x=>pkg(''+x.body),
  eval:x=>parser.parse(''+x.body),
  sh:x=>str(Exec(''+x.body)+''),
  js:x=>(eval(''+x.body),x),
  sleep:x=>(slp.usleep(0|num(x.body).body),x),
  exit:x=>{process.exit()},
  //combinators/applications
  S:(x,y)=>I(app(x,y)),
  K:(x,y)=>x,
  I:x=>x,
  tt:x=>(x.rev=1,x),
  ss:(x,y)=>x.body.reduceRight((a,b)=>I(app(b,a)),y),
  sS:(x,y)=>y.body.reduce((a,b)=>I(app(a,b)),x)
};

//cm aliases
[
  ['+','add'],
  ['|^','ceil'],
  ['/','div'],
  ['e^','exp'],
  ['|_','flr'],
  ['%','mod'],
  ['*','mul'],
  ['^','pow'],
  ['|=','round'],
  ['+-','sign'],
  ['-','sub'],
  ['|-','trunc'],
  ['=','eq'],
  ['>','gt'],
  ['<','lt'],
  ['>=','gteq'],
  ['<=','lteq'],
  ['_','neg'],
  ['->','map'],
  ['+>','fold'],
  ['<+','foldr'],
  ['_>','tkwl'],
  ['~>','drwl'],
  ['!>','fltr'],
  [':>','find'],
  [',>','findi'],
  ['*>','every'],
  ['/>','some'],
  [':','get'],
  [':^','iget'],
  [':=','set'],
  [':=^','iset'],
  [':+','ins'],
  [':+^','iins'],
  ['><','join'],
  ['<>','split'],
  ['++','con'],
  ['$$','eval'],
  ['%%','sleep'],
  ['<|>','chunk'],
  ['&','and'],
  ['|','or'],
  ['$','xor'],
  ['!','not'],
  ["'",'tsp'],
  [',','ind']
].map(a=>cm[a[0]]=cm[a[1]])

Pr=[]

//error message displaying
const error=(e,f)=>{
  console.log('\x1b[31mERROR:\x1b[0m '+e)
  f&&process.exit()
},

//getting error type
ERR=e=>
  e.message.match`\\[DecimalError\\]`?
    e.message.match(`Invalid argument`)&&'invalid argument passed to '+(e.stack.match`cm\\.([^ \\n;0-9".[\\]\\(){}@#TF?]+) `||[,'number conversion'])[1]
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
  :x,

//pre-initialized variables
//variables with x=> in front of them will be re-evaluated each call
vs={
  pi:x=>num(d.acos(-1)),
  e:x=>num(d.exp(1)),
  phi:x=>num(d.div(d.add(1,d.sqrt(5)),2)),
  ep:x=>num('.'+'0'.repeat(d.precision)+1),
  cm:x=>ls(l(cm).map((a,b)=>fn(b))),
  N:ls(l.generate(x=>num(x),1/0)),
  P:ls(l.generate(x=>x+2,1/0).filter(
    x=>(X=l(Pr).filter(a=>a*a<=x).every(a=>x%a),X&&Pr.push(x),X)
  ).map(num))
}

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
    ps&&ps.length&&(fg.get('expr')?console.log('\n'+form(I(ps))):I(ps))
    console.log('')
  }catch(e){
    error(ERR(e),halt)
  }
}

//reading from string with --e
else if(E=fg.get('e')){
  try{
    ps=parser.parse(E)
    ps&&ps.length&&(fg.get('expr')?console.log('\n'+form(I(ps))):I(ps))
    console.log('')
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
