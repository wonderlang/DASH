#!/usr/bin/env node

fs=require('fs')
fg=require('flags')
peg=require('pegjs')
_=require('lodash')
d=require('decimal.js')
tr=require('traverse')
P=require('path')
slp=require('sleep')
prompt=require('prompt-sync')()
d.config({
  toExpNeg:-9e15,
  toExpPos:9e15,
  crypto:true,
  modulo:d.EUCLID
})
fg.defineBoolean('expr',true)
fg.defineString('f')
fg.parse()
lex=fs.readFileSync(P.join(__dirname,'dash.pegjs'))+''
get=(x,y)=>x[d.mod(d(y).cmp(-1)?y:d.add(x.length,y),x.length)]
tru=x=>(
  {
    type:'bool',
    body:
      !x?
        0
      :x.type=='num'?
        +(x.body!=0)
      :x.type=='str'||x.type=='ls'?
        +!!x.length
      :x.type=='bool'?
        x.body
      :1
  }
)

form=x=>
  x.type=='num'?
    `\x1b[33m${x.body.replace(/Infinity/g,'oo').replace(/-/g,'_')}\x1b[0m`
  :x.type=='fn'?
    `\x1b[34m${x.body}\x1b[0m`
  :x.type=='str'?
    `\x1b[32m"${x.body.replace(/"/g,'\\"').replace(/\x1b\[.+?m/g,'')}"\x1b[0m`
  :x.type=='bool'?
    `\x1b[36m${x.body?'T':'F'}\x1b[0m`
  :x.type=='ls'?
    `[${x.body.map(a=>form(a)).join`;`}]`
  :x.type=='def'?
    `\x1b[92m@${form(x.body)}\x1b[0m`
  :x.map?
    `(${x.map(a=>form(a)).join`;`})`
  :x.type=='pt'?
    `\x1b[34m${x.body}\x1b[0m`+form(x.f)
  :x.type=='a'||x.type=='ref'?
    `\x1b[34m#${x.body}\x1b[0m`
  :x.type=='app'?
    form(x.body)+' '+form(x.f)
  :x.type=='var'?
    form(x.body)+'\\'+form(x.f)
  :x.type=='cond'?
    `[${form(x.body)}?${form(x.f)}?${form(x.g)}]`
  :error('failed to format JSON\n'+x)
sform=x=>
  x.type=='num'?
    x.body.replace(/Infinity/g,'oo').replace(/-/g,'_')
  :x.type=='fn'||x.type=='str'||x.type=='a'||x.type=='ref'?
    x.body
  :x.type=='bool'?
    x.body?'T':'F'
  :x.type=='ls'?
    x.body.map(a=>sform(a)).join` `
  :x.type=='def'?
    `@(expr)`
  :x.map?
    `(expr)`
  :x.type=='app'?
    sform(x.body)+' '+sform(x.f)
  :x.type=='cond'?
    '[cond]'
  :error('failed to format JSON\n'+JSON.stringify(x))

cm={
  os:x=>(console.log(form(x)),x),
  ol:x=>(console.log(sform(x)),x),
  wf:(x,y)=>(fs.writeFileSync(x.body,sform(y)),y),
  rl:x=>(i=prompt('',0),i?{type:'str',body:i}:{type:'bool',body:0}),
  rf:x=>({type:'str',body:fs.readFileSync(x.body)+''}),
  E:x=>(d.config({precision:0|x.body}),x),
  abs:x=>({type:'num',body:''+d.abs(x.body)}),
  acos:x=>({type:'num',body:''+d.acos(x.body)}),
  acosh:x=>({type:'num',body:''+d.acosh(x.body)}),
  add:(x,y)=>({type:'num',body:''+d.add(x.body,y.body)}),
  asin:x=>({type:'num',body:''+d.asin(x.body)}),
  asinh:x=>({type:'num',body:''+d.asinh(x.body)}),
  atan:x=>({type:'num',body:''+d.atan(x.body)}),
  atanh:x=>({type:'num',body:''+d.atanh(x.body)}),
  atant:(x,y)=>({type:'num',body:''+d.atan2(x.body,y.body)}),
  ceil:x=>({type:'num',body:''+d.ceil(x.body)}),
  cos:x=>({type:'num',body:''+d.cos(x.body)}),
  cosh:(x,y)=>({type:'num',body:''+d.cosh(x.body)}),
  div:(x,y)=>({type:'num',body:''+d.div(x.body,y.body)}),
  exp:x=>({type:'num',body:''+d.exp(x.body)}),
  floor:x=>({type:'num',body:''+d.floor(x.body)}),
  hypot:(x,y)=>({type:'num',body:''+d.hypot(x.body,y.body)}),
  ln:x=>({type:'num',body:''+d.ln(x.body)}),
  lt:x=>({type:'num',body:''+d.log10(x.body)}),
  log:(x,y)=>({type:'num',body:''+d.log(x.body,y.body)}),
  max:x=>({type:'num',body:''+d.max(...x.body)}),
  min:x=>({type:'num',body:''+d.min(...x.body)}),
  mod:(x,y)=>({type:'num',body:''+d.mod(x.body,y.body)}),
  mul:(x,y)=>({type:'num',body:''+d.mul(x.body,y.body)}),
  pow:(x,y)=>({type:'num',body:''+d.pow(x.body,y.body)}),
  round:x=>({type:'num',body:''+d.round(x.body)}),
  sign:x=>({type:'num',body:''+d.sign(x.body)}),
  sin:x=>({type:'num',body:''+d.sin(x.body)}),
  sinh:x=>({type:'num',body:''+d.sinh(x.body)}),
  sub:(x,y)=>({type:'num',body:''+d.sub(x.body,y.body)}),
  tan:x=>({type:'num',body:''+d.tan(x.body)}),
  tanh:x=>({type:'num',body:''+d.tanh(x.body)}),
  trunc:x=>({type:'num',body:''+d.trunc(x.body)}),
  cmp:(x,y)=>({type:'bool',body:d(x.body).cmp(y.body)}),
  eq:(x,y)=>({type:'bool',body:+(x.body==y.body)}),
  eqs:(x,y)=>({type:'bool',body:+(x.body==y.body&&x.type==y.type)}),
  gt:(x,y)=>({type:'bool',body:d(x.body).cmp(y.body)==1}),
  lt:(x,y)=>({type:'bool',body:d(x.body).cmp(y.body)==-1}),
  lteq:(x,y)=>({type:'bool',body:d(x.body).lte(y.body)}),
  gteq:(x,y)=>({type:'bool',body:d(x.body).gte(y.body)}),
  neg:x=>({type:'num',body:''+d(x.body).neg()}),
  map:(x,y)=>({type:'ls',body:_.map(y.body,a=>I({type:'app',body:x,f:a.big?{type:'str',body:a}:a}))}),
  fold:(x,y)=>_.reduce(y.body,(a,b)=>I({type:'app',body:{type:'app',body:x.body[0],f:b.big?{type:'str',body:b}:b},f:a.big?{type:'str',body:a}:a}),x.body[1]),
  tkwl:(x,y)=>({type:'ls',body:_.takeWhile(y.body,a=>tru(I({type:'app',body:x,f:a.big?{type:'str',body:a}:a})).body)}),
  fltr:(x,y)=>({type:'ls',body:_.filter(y.body,a=>tru(I({type:'app',body:x,f:a.big?{type:'str',body:a}:a})).body)}),
  find:(x,y)=>({type:'ls',body:_.find(y.body,a=>tru(I({type:'app',body:x,f:a.big?{type:'str',body:a}:a})).body)}),
  ifind:(x,y)=>({type:'ls',body:_.findIndex(y.body,a=>tru(I({type:'app',body:x,f:a.big?{type:'str',body:a}:a})).body)}),
  len:x=>({type:'num',body:x.body.length}),
  get:(x,y)=>y.type=='ls'?{type:'ls',body:y.body.map(a=>get(x.body,a.body))}:x.body.big?{type:'str',body:get(x.body,y.body)}:get(x.body,y.body),
  join:(x,y)=>({type:'str',body:_.map(x.body,a=>sform(a)).join(y.body)}),
  split:(x,y)=>({type:'ls',body:x.body.split(y.body).map(a=>({type:'str',body:a}))}),
  tc:x=>({type:'ls',body:_.map(x.body,a=>({type:'num',body:''+a.codePointAt()}))}),
  fc:x=>({type:'str',body:x.type=='ls'?x.body.map(a=>String.fromCodePoint(0|a.body)).join``:String.fromCodePoint(0|x.body)}),
  bool:tru,
  not:x=>({type:'bool',body:+!tru(x).body}),
  num:x=>({type:'num',body:''+d(x.body.replace(/_/g,'-').replace(/oo/g,'Infinity'))}),
  rnd:x=>({type:'num',body:''+d.random(x&&x.body&&0|x.body?0|x.body:[]._)}),
  con:(x,y)=>x.type!='ls'&&y.type!='ls'?{type:'str',body:form(x)+form(y)}:{type:'ls',body:_.concat(x.type=='ls'?x.body:x,y.type=='ls'?y.body:y)},
  rev:x=>x.body.big?{type:'str',body:[...x.body].reverse().join``}:{type:'ls',body:x.body.reverse()},
  rng:(x,y)=>({type:'ls',body:
    [...
      (function*(a,b){
        while(d(a).lt(b)){
          yield{type:'num',body:''+a};
          a=''+d.add(a,1)
        }
      })(x.body,y.body)
    ]}),
  str:x=>({type:'str',body:sform(x)}),
  src:x=>({type:'str',body:form(x)}),
  eval:x=>exec(parser.parse(x.body)),
  S:(x,y)=>I({type:'app',body:x,f:y}),
  sleep:x=>(slp.usleep(0|x.body),0|x.body),
  T:x=>(x.rev=1,x),
  sort:x=>({type:'ls',body:_.sortBy(_.map(x.body,a=>a.big?{type:'str',body:a}:a),a=>a.body)}),
  type:x=>({type:'str',body:x.type}),
  sum:x=>({type:'num',body:''+_.reduce(x.body,(a,b)=>d.add(a,b.body),0)}),
  prod:x=>({type:'num',body:''+_.reduce(x.body,(a,b)=>d.mul(a,b.body),1)}),
  chunk:(x,y)=>({type:'ls',body:x.type=='ls'?_.chunk(x.body,0|y.body).map(a=>({type:'ls',body:a})):x.body.match(RegExp('.'.repeat(_.clamp(y.body,0,x.body.length)),'g')).map(a=>({type:x.type=='str'?'str':'num',body:a}))}),
  fib:x=>({type:'ls',body:
    [...
      (function*(n=null,x='0',y='1'){
        while(d(n=d(n).sub(1)+'').gt(0)){
          yield{type:'num',body:''+x};
          [x,y]=[y,''+d.add(x,y)]
        }
      })(0|x.body)
    ]}),
  K:(x,y)=>x,
  I:x=>x
}
cm['||']=cm.abs
cm['+']=cm.add
cm["|'"]=cm.ceil
cm['/']=cm.div
cm['|_']=cm.floor
cm['%']=cm.mod
cm['*']=cm.mul
cm['^']=cm.pow
cm['|:']=cm.round
cm['+-']=cm.sign
cm['-']=cm.sub
cm['|-']=cm.trunc
cm['=']=cm.eq
cm['==']=cm.eqs
cm['>']=cm.gt
cm['<']=cm.lt
cm['<=']=cm.lteq
cm['>=']=cm.gteq
cm['_']=cm.neg
cm['->']=cm.map
cm['+>']=cm.fold
cm['_>']=cm.tkwh
cm['!>']=cm.fltr
cm[':>']=cm.find
cm['$:>']=cm.ifind
cm['__']=cm.len
cm[':']=cm.get
cm['><']=cm.join
cm['<>']=cm.split
cm['<|>']=cm.chunk
cm['e^']=cm.exp
cm['!']=cm.not
cm[',!']=cm.bool
cm[',$']=cm.num
cm[",'"]=cm.str
cm[',,']=cm.src
cm['&']=cm.con
cm['|']=cm.eval
cm['%,']=cm.sleep

vs={
  pi:{type:'num',body:'3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609433057270365759591953092186117381932611793105118548074462379962749567351885752724891227938183011949129833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132000568127145263560827785771342757789609173637178721468440901224953430146549585371050792279689258923542019956112129021960864034418159813629774771309960518707211349999998372978049951059731732816096318595024459455346908302642522308253344685035261931188171010003137838752886587533208381420617177669147303598253490428755468731159562863882353787593751957781857780532171226806613001927876611195909216420199'},
  e:{type:'num',body:'2.718281828459045235360287471352662497757247093699959574966967627724076630353547594571382178525166427427466391932003059921817413596629043572900334295260595630738132328627943490763233829880753195251019011573834187930702154089149934884167509244761460668082264800168477411853742345442437107539077744992069551702761838606261331384583000752044933826560297606737113200709328709127443747047230696977209310141692836819025515108657463772111252389784425056953696770785449969967946864454905987931636889230098793127736178215424999229576351482208269895193668033182528869398496465105820939239829488793320362509443117301238197068416140397019837679320683282376464804295311802328782509819455815301756717361332069811250996181881593041690351598888519345807273866738589422879228499892086805825749279610484198444363463244968487560233624827041978623209002160990235304369941849146314093431738143640546253152096183690888707016768396424378140592714563549061303107208510383750510115747704171898610687396965521267154688957035035'},
  phi:{type:'num',body:'1.618033988749894848204586834365638117720309179805762862135448622705260462818902449707207204189391137484754088075386891752126633862223536931793180060766726354433389086595939582905638322661319928290267880675208766892501711696207032221043216269548626296313614438149758701220340805887954454749246185695364864449241044320771344947049565846788509874339442212544877066478091588460749988712400765217057517978834166256249407589069704000281210427621771117778053153171410117046665991466979873176135600670874807101317952368942752194843530567830022878569978297783478458782289110976250030269615617002504643382437764861028383126833037242926752631165339247316711121158818638513316203840052221657912866752946549068113171599343235973494985090409476213222981017261070596116456299098162905552085247903524060201727997471753427775927786256194320827505131218156285512224809394712341451702237358057727861600868838295230459264787801788992199027077690389532196819861514378031499741106926088674296226757560523172777520353613936'},
  oo:{type:'num',body:'Infinity'}
}

error=e=>{
  console.log('\x1b[31mERROR:\x1b[0m '+e)
  process.exit(1)
}

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
    :a.body>D?(a.body-=1,a):a
  )
}))

I=x=>
  (x.type=='num'&&x.body=='NaN')||(x.pop&&!x.length)?
    {type:'bool',body:0}
  :x.type=='cond'?
    tru(x.body).body?I(x.f):I(x.g)
  :x.map?
    (X=x.map(a=>I(a)))[X.length-1]
  :x.type=='ls'?
    {type:'ls',body:x.body.map(a=>I(a))}
  :x.type=='var'?
    (vs[x.body.body]=x.f)
  :(x.type=='ref'||x.type=='fn')&&vs[x.body]?
    vs[x.body]
  :x.type=='app'?
    (z=I(x.body)).type=='fn'?
      cm[z.body]?
        cm[z.body].length>1?
          {type:'pt',body:z.body,f:I(x.f),rev:z.rev}
        :cm[z.body](I(x.f))
      :error(`undefined function "${z.body}"`)
    :z.type=='def'?
      ua(z,x.f).body
    :z.type=='pt'?
      z.rev?cm[I(z).body](I(x.f),z.f):cm[I(z).body](z.f,I(x.f))
    :x
  :x

//In=x=>tr(x).nodes().some(a=>a.type=='app'||a.type=='var'||(a.type=='fn'&&vs[a.body])||a.type=='ref')
exec=x=>{
  while(!_.isEqual(X=I(x),x))x=X;return x
}

if(F=fg.get('f')){
  try{
    code=fs.readFileSync(F)+''
    parser=peg.generate(lex)
    ps=parser.parse(code)
    ps&&ps.length&&(fg.get('expr')?console.log(form(exec(ps))):exec(ps))
  }catch(e){
    error(
      e.message.match`\\[DecimalError\\]`?
        e.message.match(`Invalid argument`)&&'invalid argument passed to '+e.stack.match`cm\\.(.+) `[1]
      :e.message.match`Maximum call stack size exceeded`?
        'too much recursion'
      :e.stack.match`peg\\$buildStructuredError`?
        'failed to parse\n'+e.message
      :'js error -> '+e.stack
    )
  }
}else{
  logo=fs.readFileSync('dash.txt')+''
  pkg=fs.readFileSync('package.json')+''
  console.log(`\x1b[36m\x1b[1m${logo.replace(/1/g,'\x1b[4m').replace(/0/g,'\x1b[24m')}\x1b[0m\n\n\x1b[93m\x1b[1mv${JSON.parse(pkg).version}\x1b[21m\n\x1b[2mMade with love by Ben Pang (molarmanful).\x1b[0m`)
}