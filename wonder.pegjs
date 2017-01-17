start=a:(com/expr)*{
  return a.filter(x=>!x.big)
}

expr=a:(_/type)';'?{
  return a
}

//separators
_=[ \n]

//types
type=str/rgx/bin/oct/hex/num/bool/cond/ls/ev/obj/pm/var/comp/aapp/app/pm/def/arg/ufn/tfn/fn/a/ref

//comments
com='#.'[^\n]*{return''}

//strings
str='"'a:([^"\\]/'\\'.)*'"'?{
  return{
    type:'str',
    body:a.map(x=>x.pop?x[1]=='"'?'"':x.join``:x).join``.replace(/\\\\/g,'\\')
  }
}
rgx='`'a:([^`\\]/'\\'.)*'`'?b:[a-zA-Z]*{
  return{
    type:'app',
    body:{
      type:'app',
      body:{type:'fn',body:'R'},
      f:{
        type:'str',
        body:a.map(x=>x.pop?x[1]=='"'?'"':x.join``:x).join``.replace(/\\\\/g,'\\')
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
  var f
  return{
    type:'num',
    body:a!='oo'?a.replace(/_/g,'-'):a!='_oo'?'Infinity':'-Infinity'
  }
}
bin=a:$('_'?'0b'([01]+('.'[01]+)?/'.'[01]+)){
  var f
  return{
    type:'num',
    body:a.replace(/_/g,'-')
  }
}
oct=a:$('_'?'0o'([0-8]+('.'[0-8]+)?/'.'[0-8]+)){
  var f
  return{
    type:'num',
    body:a.replace(/_/g,'-')
  }
}
hex=a:$('_'?'0x'([0-9A-Fa-f]+('.'[0-9A-Fa-f]+)?/'.'[0-9A-Fa-f]+)){
  var f
  return{
    type:'num',
    body:a.replace(/_/g,'-')
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
  return{
    type:'ls',
    body:a.filter(x=>!x.big)
  }
}
//object
obj='{'_*a:((num/fn/str)_*'\\'_*type _*';'?_*)*_*'}'?{
  var o={}
  return{
    type:'obj',
    body:(a.map(x=>o[x[0].body]=x[4]),o)
  }
}
pm='.{'_*a:(type _*'\\'_*type _*';'?_*)*b:type? _*'}'?{
  return{
    type:'pm',
    body:(
      a.map(x=>[x[0],x[4]]).concat([['@',b||{type:'bool',body:0}]])
    )
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
ref=a:('#'_*(fn/arg/ls/def/obj/pm/rgx)){
  return{
    type:'ref',
    body:a[2]
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
app=a:(tfn/fn/def)_*b:type{
  return{
    type:'app',
    body:a.pop?a[1]:a,
    f:b
  }
}
aapp=a:(ufn/app/arg)_*b:type{
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

comp=a:(ufn/tfn/aapp/app/fn/def/arg/ls/obj/pm/rgx)_*b:('.'_*(ufn/tfn/aapp/app/fn/def/arg/ls/obj/pm/rgx)_*)+{
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
cond='['_*a:type _*'?'_*b:expr*_*'?'_*c:expr*_*']'?{
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