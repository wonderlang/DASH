#!/usr/bin/env node

//dependencies
fs=require('fs')
req=require('sync-request')
Exec=require('child_process').execSync

//create wpm folder if not already created
try{
  fs.mkdirSync('wpm')
  console.log('Created wpm folder')
}catch(e){
  if(e.code!='EEXIST')throw e
}

//fetch the registry from Github and convert to matrix
list=(
  req('GET','https://raw.githubusercontent.com/wonderlang/wpm-list/master/registry').body+''
).split`\n`.map(x=>x.split` `)

//install
if(process.argv[2]=='install'){
  process.argv.slice(3).map(x=>{
    //format URL or pkg name in array ["name", "repo URL"]
    X=x.match`github.com/[^/]+/wonder-`?
      [x,x.match`^(https?:/?/?)?github.com/[^/]+/wonder-([^/]+)`[1]]
    :[(A=list[list.findIndex(a=>a[0]==x)]||[])[1],A[0]]

    //perform a git clone inside wpm if pkg doesn't exist already
    fs.readdir('wpm/'+X[1],a=>{
      a&&a.code=='ENOENT'&&(
        Exec(`cd wpm;git clone -q ${X[0]} ${X[1]}`),
        console.log(`Cloned package "${X[1]}" into wpm`)
      )
    })
  })
}

//uninstall
else if(process.argv[2]=='uninstall'){
  //simply remove the package from the wpm directory
  process.argv.slice(3).map(x=>{
    Exec('rm -rf wpm/'+x)
    console.log(`Uninstalled package "${x}" from wpm`)
  })
}

//update
else if(process.argv[2]=='update'){
  //perform a git pull inside wpm
  process.argv.slice(3).map(x=>{
    Exec(`cd wpm/${x};git pull origin master -q`)
    console.log(`Updated package "${x}"`)
  })
}

//default: display help
else{
  console.log(`USAGE: delishusly [command] [args...]\n---\nCOMMANDS:\n - install [name/url]\n - uninstall [name]\n - update [name]\n`)
}
