//pre-initialized variables
//variables with x=> in front of them will be re-evaluated each call
vs={
  pi:x=>num(d.acos(-1)),
  e:x=>num(d.exp(1)),
  phi:x=>num(d.div(d.add(1,d.sqrt(5)),2)),
  ep:x=>num('.'+'0'.repeat(d.precision)+1),
  cm:x=>ls(l(cm).map((a,b)=>fn(b))),
  N:x=>ls(l.generate(x=>num(x),1/0)),
  P:x=>cm.fltr(fn('pr'),ls(l.generate(x=>num(x),1/0)))
}
