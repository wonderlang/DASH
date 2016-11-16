#!/usr/bin/env node

fs=require('fs')
req=require('sync-request')
Exec=require('child_process').execSync

try{
  fs.mkdirSync('wpm')
  console.log('Created wpm folder')
}catch(e){
  if(e.code!='EEXIST')throw e
}

list=(req('GET','https://raw.githubusercontent.com/wonderlang/wpm-list/master/registry').body+'').split`\n`.map(x=>x.split` `)

if(process.argv[2]=='install'){
  process.argv.slice(3).map(x=>{
    X=x.match`github.com/[^/]+/wonder-`?
      [x,x.match`^(https?:/?/?)?github.com/[^/]+/wonder-([^/]+)`[1]]
    :[(A=list[list.findIndex(a=>a[0]==x)]||[])[1],A[0]]
    fs.readdir('wpm/'+X[1],a=>{
      a&&a.code=='ENOENT'&&(Exec(`cd dpm;git clone -q ${X[0]} ${X[1]}`),console.log(`Cloned package "${X[1]}" into wpm`))
    })
  })
}
else if(process.argv[2]=='uninstall'){
  process.argv.slice(3).map(x=>{
    Exec('rm -rf wpm/'+x)
    console.log(`Uninstalled package "${x}" from wpm`)
  })
}
else if(process.argv[2]=='update'){
  process.argv.slice(3).map(x=>{
    Exec(`cd wpm/${x};git pull origin master -q`)
    console.log(`Updated package "${x}"`)
  })
}