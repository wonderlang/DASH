start=a:(com/expr)*{
  return a.filter(x=>!x.big)
}

expr=a:(_/type)';'?{
  return a
}

//separators
_=[ \n]

//types
type=str/rgx/bin/oct/hex/num/bool/cond/lsc/ls/ev/obj/defn/pmv/var/comp/aapp/app/pm/def/arg/utfn/ufn/tfn/fn/a/ref

//comments
com='#.'[^\n]*{return''}

//strings
str='"'a:('#'arg/$([^"\\]/'\\'.))*'"'?{
  return{
    type:'istr',
    body:a.reduce((x,y)=>x.concat(y.map?[y[1]]:y.replace(/\\\\/g,'\\')),[])
  }
}
rgx='`'a:('#'arg/$([^`\\]/'\\'.))*'`'?b:[a-zA-Z]*{
  return{
    type:'app',
    body:{
      type:'app',
      body:{type:'fn',body:'R'},
      f:{
        type:'istr',
        body:a.reduce((x,y)=>x.concat(y.map?[y[1]]:y.replace(/\\\\/g,'\\')),[])
      }
    },
    f:{
      type:'str',
      body:b.join``
    }
  }
}
//numbers
num=a:$('_'?[0-9]+('.'[0-9]+)?('e''_'?[0-9]+)?/'_'?'.'[0-9]+('e''_'?[0-9]+)?/'_'?'oo'){
  return{
    type:'num',
    body:a!='oo'?a.replace(/_/g,'-'):a!='_oo'?'Infinity':'-Infinity'
  }
}
bin=a:$('_'?'0b'([01]+('.'[01]+)?/'.'[01]+)){
  return{
    type:'num',
    body:a.replace(/_/g,'-')
  }
}
oct=a:$('_'?'0o'([0-8]+('.'[0-8]+)?/'.'[0-8]+)){
  return{
    type:'num',
    body:a.replace(/_/g,'-')
  }
}
hex=a:$('_'?'0x'([0-9A-Fa-f]+('.'[0-9A-Fa-f]+)?/'.'[0-9A-Fa-f]+)){
  return{
    type:'num',
    body:a.replace(/_/g,'-')
  }
}

//bool
bool=a:[TFU]{
  return a=='U'?{type:'u'}:{
    type:'bool',
    body:+(a=='T')
  }
}

//list
ls='['a:('..'?expr)*']'?{
  return a.reduce((x,y)=>y[1].big?x:{
  	type:'app',
    body:{
   	  type:'app',
      body:{type:'fn',body:'++'},
      f:x
    },
    f:y[0]?y[1]:{type:'ls',body:[y[1]]}
  },{type:'ls',body:[]})
}
//object
obj='{'_*a:((num/fn/str)_*'\\'_*type _*';'?_*)*_*'}'?{
  var o={}
  return{
    type:'obj',
    body:(a.map(x=>o[x[0].body]=x[4]),o)
  }
}
pm='.{'_*a:(type _*('\\'/'?')_*type _*';'?_*)*b:type? _*'}'?{
  return{
    type:'pm',
    body:(
      a.map(x=>[x[0],x[4],x[2]=='?'])
    ),
    f:b||{type:'bool',body:0}
  }
}
pmv=a:fn _*b:(type/'..') _*'\\'_*c:type{
  return{
  	type:'pmv',
    body:a.body,
    f:b=='..'?null:b,
    g:c
  }
}
//expression list (holds multiple expressions)
arg='('a:expr*')'?{
  return a.filter(x=>!x.big)
}
//argument reference
a=a:('#'_*[0-9]+){
  return{
    type:'a',
    body:+a[2].join``
  }
}
ref=a:('#'_*(rgx/defn/pm/def/arg/utfn/ufn/tfn/fn/ref)){
  return a[2]
}

//function reference
fn=a:[^ \n;0-9".[\]\\(){}@#TFU?`]+{
  return{
    type:'fn',
    body:a.join``
  }
}
//function application
app=a:(tfn/fn/def)_*b:type{
  return{
    type:'app',
    body:a.pop?a[1]:a,
    f:b
  }
}
aapp=a:(utfn/ufn/pm/app/arg)_*b:type{
  return{
    type:'app',
    body:a,
    f:b
  }
}
ufn="'"a:fn{
  return{
    type:'fn',
    body:a.body
  }
}
tfn="^"a:fn{
  return{
    type:'fn',
    body:a.body,
    rev:1
  }
}
utfn=("^'"/"'^")a:fn{
  return{
    type:'fn',
    body:a.body,
    rev:1
  }
}

comp=a:(utfn/ufn/tfn/aapp/app/fn/def/arg/lsc/ls/obj/pm/rgx)_*b:('.'_*(ufn/tfn/aapp/app/fn/def/arg/lsc/ls/obj/pm/rgx)_*)+{
  return{
    type:'app',
    body:{type:'fn',body:'ss'},
    f:{
      type:'ls',
      body:[a,...b.map(x=>x[2])]
    }
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
cond='('_*a:type _*'?'_*b:expr*_*'?'_*c:expr*_*')'?{
  return{
  	type:'cond',
    body:a,
    f:b&&b.length?b.filter(x=>!x.big):{type:'bool',body:1},
    g:c&&c.length?c.filter(x=>!x.big):{type:'bool',body:0}
  }
}

//eval block
ev=a:arg _*b:var{
  return{
    type:'ev',
    body:a.filter(x=>!x.big),
    f:b.body,
    g:b.f
  }
}
//lambda w/ named arg
defn=a:fn _*'\\\\'_*b:type{
  return{
    type:'def',
    body:{
      type:'ev',
      body:[].concat(b),
      f:a,
      g:{
        type:'a',
        body:0
      }
    }
  }
}
//list comprehension
lsc='['_*a:type _*'?'_*b:(var _*';'?_*)+c:type? _*']'?{
  return b.reduce((x,y,z,w)=>(w={
  	type:'lsc',
    body:x,
    f:y[0],
    g:z?{type:'bool',body:1}:c||{type:'bool',body:1}
  },z?{
  	type:'app',
    body:{type:'fn',body:'flat'},
    f:w
  }:w),a)
}