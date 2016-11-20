start=a:(com/expr)*{
  return a.filter(x=>!x.big)
}

expr=a:(_/type)';'?{
  return a
}

//separators
_=[ \n]

//types
type=str/bin/get/oct/hex/num/bool/cond/ls/ev/obj/var/aapp/app/def/arg/fn/a/ref

//comments
com='#.'[^\n]*{return''}

//strings
str='"'a:([^"\\]/'\\'.)*'"'?{
  return{
    type:'str',
    body:a.map(x=>x.pop?x[1]=='"'?'"':x.join``:x).join``.replace(/\\\\/g,'\\')
  }
}
//numbers
num=a:([0-9]+('.'[0-9]+)?('e''_'?[0-9]+)?/'.'[0-9]+('e''_'?[0-9]+)?/'oo'){
  var f
  return{
    type:'num',
    body:a!='oo'?(f=z=>z.map(x=>x&&x.pop?f(x):x).join``.replace(/_/g,'-'))(a):'Infinity'
  }
}
bin=a:('0b'([01]+('.'[01]+)?/'.'[0-9]+)){
  var f
  return{
    type:'num',
    body:(f=z=>z.map(x=>x&&x.pop?f(x):x).join``.replace(/_/g,'-'))(a)
  }
}
oct=a:('0o'([0-8]+('.'[0-8]+)?/'.'[0-8]+)){
  var f
  return{
    type:'num',
    body:(f=z=>z.map(x=>x&&x.pop?f(x):x).join``.replace(/_/g,'-'))(a)
  }
}
hex=a:('0x'([0-9A-Fa-f]+('.'[0-9A-Fa-f]+)?/'.'[0-9A-Fa-f]+)){
  var f
  return{
    type:'num',
    body:(f=z=>z.map(x=>x&&x.pop?f(x):x).join``.replace(/_/g,'-'))(a)
  }
}

//bool
bool=a:[TF]{
  return{
    type:'bool',
    body:+(a=='T')
  }
}

//list
ls='['a:expr*']'?{
  a=a.filter(x=>!x.big)
  return a.reduce((x,y)=>({
    type:'app',
    body:{
      type:'app',
      body:{type:'fn',body:'cat'},
      f:x
    },
    f:y
  }),{type:'ls',body:[]})
}
//object
obj='{'_*a:((num/fn/str)_*'\\'_*type _*';'?)*_*'}'?{
  var o={}
  return{
    type:'obj',
    body:(a.map(x=>o[x[0].body]=x[4]),o)
  }
}
//expression list (holds multiple expressions)
arg='('a:expr*')'?{
  return a.filter(x=>!x.big)
}
//argument reference
a=a:('#'[0-9]+){
  return{
    type:'a',
    body:+a[1].join``
  }
}
ref=a:('#'fn){
  return{
    type:'ref',
    body:a[1].body
  }
}

//function reference
fn=a:[^ \n;0-9".[\]\\(){}@#TF?`]+{
  return{
    type:'fn',
    body:a.join``
  }
}
//function application
app=a:(fn/def)_* b:type{
  return{
    type:'app',
    body:a.pop?a[1]:a,
    f:b
  }
}
aapp=a:(app/arg) _*b:type{
  return{
    type:'app',
    body:a,
    f:b
  }
}
//function definition
def='@'_*b:type{
  return{
    type:'def',
    body:b
  }
}
var=a:fn _*'\\'_*b:type{
  return{
    type:'var',
    body:a,
    f:b
  }
}

//conditionals
cond='['_*a:type _*'?'_*b:expr*_*'?'_*c:expr*_*']'?{
  return{
  	type:'cond',
    body:a,
    f:b&&b.length?b.filter(x=>!x.big):{type:'bool',body:1},
    g:c&&c.length?c.filter(x=>!x.big):{type:'bool',body:0}
  }
}

//eval block
ev='{'a:expr*'}'_*b:var{
  return{
    type:'ev',
    body:a.filter(x=>!x.big),
    f:b.body,
    g:b.f
  }
}

//get
get=a:((num/fn/str)'`'_*)+ b:type{
  return{
    type:'app',
    body:{
      type:'app',
      body:{type:'fn',body:'ss'},
      f:{
        type:'ls',
        body:a.map(x=>({
          type:'app',
          body:{type:'fn',body:'get'},
          f:x[0]
        }))
      }
    },
    f:b
  }
}
