(function() {
    var FSO=new ActiveXObject("Scripting.FileSystemObject")
    function doDeferedSearch(txt) {    
        FARR.setInterval(0, 1,function() { 
            FARR.killInterval(0);
            FARR.setStrValue("stopsearch","");
            FARR.setStrValue("launch","dosearch "+txt);
            //displayBalloonMessage(txt);
        });
    }
    
    var fileRx=/^([a-zA-Z]:.*?)( » *|;|$)/;
    var verbRx=/^[a-z]+/;
    function match(r,i) {
        if(i==undefined) i=0;
        //WScript.Echo("r : "+query.substring(index)+" : "+r);
        var begin=index;
        var m=query.substring(index).match(r);
        if(!m) throw "parse error at "+index+". '"+query.substring(index)+"' does not match "+r;
        index+=m[i].length;
        return [m[i],begin,index];
    }

    function lookahead(r) {
        var m=query.substring(index).match(r);
        if(m) return m[0];
    }

    function parse(q) {
        var r={};
        r.filelist=[];
        r.argc=0;
        try {
            query=q;
            index=0;

            match(/^>/); match(/^ */);
            // filelist
            r.expectType="filelist";
            var f=match(fileRx,1); if(f) r.filelist.push(f);
            r.expectValue=f||["",index,index];
            r.argc++;
            while(lookahead(/^;/)) {
                match(/^;/);
                f=match(fileRx,1); if(f) r.filelist.push(f);
                r.expectValue=f||["",index,index];
            }

            // arrow        
            match(/^ » */);
            r.expectType="verb";
            r.expectValue=["",index,index];

            // verb
            r.verb=match(verbRx)
            r.expectValue=r.verb||["",index,index];
            r.argc++;

            if(r.verb[0]=="delete") {
                r.finalValue=true;
                return r;
            }

            // arrow
            match(/^ » */);
            r.expectType="file";
            r.expectValue=["",index,index];
            r.finalValue=true;

            //file
            r.target=match(fileRx,1);
            r.expectValue=r.target||["",index,index];
        } catch(e) {
            //WScript.Echo(e);
        }
        return r;
    }

    plugins["fshell"]={
        version:"v0.0.1",
        lastChange:"12 21st 2008",
        displayName:"fshell",
        directory:currentDirectory,
        icon:currentDirectory+"\\fshell.ico",
        aliasstr:">",
        //autocomplete:"colors", // replace the default completion : you need to define an alias file to use it
        search:function(querykey, explicit, queryraw, querynokeyword, modifier, triggermethod) {
            var r=parse(FARR.getQueryString());
            if(r.verb && r.target && r.finalValue) {
                var filelist=[];
                for(var i in r.filelist)
                    filelist.push(r.filelist[i][0]);

                if(r.verb[0]=="moveto")
                    FARR.emitResult(querykey,"move "+filelist.join(",")+" to "+r.target[0]+" ?",r.target[0], this.icon,UNKNOWN,IMMEDIATE_DISPLAY,-100,"");
                else if(r.verb[0]=="copyto")
                    FARR.emitResult(querykey,"copy "+filelist.join(",")+" to "+r.target[0]+" ?",r.target[0], this.icon,UNKNOWN,IMMEDIATE_DISPLAY,-100,"");
                //else if(r.verb[0]=="zipto")
                //    FARR.emitResult(querykey,"zip '"+filelist.join(",")+"' to '"+r.target[0]+"' ?",r.target[0], this.icon,UNKNOWN,IMMEDIATE_DISPLAY,-100,"");
            }


            if(!explicit) return;           
            if(queryraw.indexOf(">")!=0)
                return;

            function dbg(txt) {
                FARR.emitResult(querykey,txt,txt, "",UNKNOWN,IMMEDIATE_DISPLAY,10000,"");
            }            

            if((r.expectType=="filelist" || r.expectType=="file") && r.expectValue) {
                doDeferedSearch(r.expectValue[0]);
            }
            if(r.expectType=="verb") {
                FARR.emitResult(querykey,"moveto","moveto", this.icon,UNKNOWN,MATCH_AGAINST_SEARCH,10000,"");
                FARR.emitResult(querykey,"copyto","copyto", this.icon,UNKNOWN,MATCH_AGAINST_SEARCH,10000,"");
                FARR.emitResult(querykey,"delete","delete", this.icon,UNKNOWN,MATCH_AGAINST_SEARCH,10000,"");
                //FARR.emitResult(querykey,"zipto","zipto", this.icon,UNKNOWN,MATCH_AGAINST_SEARCH,10000,"");
                // open
                // view
                // edit
                // hexedit
                forceResultFilter(r.expectValue[0]);                
            }
            // rem : zipto should only allow filename ?
            // rem : moveto should only allow folder name ?
        },
        trigger:function(path, title, groupname, pluginid, thispluginid, score, entrytype, args,triggermode) {
            if(triggermode!=0 && triggermode!=4)
                return;

            var q=FARR.getQueryString();

            if(path.indexOf("dosearch")==0)
                return;
            if(path.indexOf("restartsearch")==0)
                return;
            if(q.indexOf(">")!=0) {
                if(FARR.getKeyState(0x11)&0x8000) {
                    restartSearch("> "+path);
                    return HANDLED;
                }
                return;
            }

            var r=parse(q);
            var query=q.substring(0, r.expectValue[1])+path+q.substring(r.expectValue[2]);
            var r=parse(query);

            var filelist=[];
            for(var i in r.filelist)
                filelist.push(r.filelist[i][0]);

            // simple tab may mean complete on verbs, etc... (but not files and folders )
            // double tab should mean next (tab on already complete result ) (ignore completion if file or folder end with \ )
            // enter should mean go
            if(triggermode==4 && r.expectType=="filelist") // tab completion
                restartSearch(query);
            if(!r.finalValue)
                restartSearch(query+" » ");
            if(r.finalValue && r.verb) {
                switch(r.verb[0]) {
                    // do the operation in an ahk script ?
                    // or evolve threaded operation in fscript ?
                    // call shfileoperation. fscript could be improved by allowing it to call native dll
                    // zipto require another way using a shell command ?
                    case "moveto":
                        var f=FSO.CreateTextFile(this.directory+"\\tmp.bat",true);
                        for(var i in filelist) {
                            var filename=filelist[i];
                            f.WriteLine("move \""+filename+"\" \""+r.target[0]+"\"");
                        }
                        f.WriteLine("pause");
                        f.Close();
                        FARR.exec(this.directory+"\\tmp.bat","",this.directory);
                        
                        return HANDLED|CLOSE;
                    case "copyto":
                        var f=FSO.CreateTextFile(this.directory+"\\tmp.bat",true);
                        for(var i in filelist) {
                            var filename=filelist[i];
                            setStatusBar("Copying "+filename+" to "+r.target[0]); 
                            if(FSO.FileExists(filename))
                                f.WriteLine("copy \""+filename+"\" \""+r.target[0]+"\"");
                            if(FSO.FolderExists(filename))
                                f.WriteLine("xcopy /E \""+filename+"\" \""+r.target[0]+"\\\"");
                        }
                        f.WriteLine("pause");
                        f.Close();
                        FARR.exec(this.directory+"\\tmp.bat","",this.directory);

                        displayAlertMessage(filelist.join(",")+" copied to "+r.target[0]);
                        return HANDLED|CLOSE;
                    case "delete":
                        for(var i in filelist) {
                            setStatusBar("Deleting "+filename);
                            var filename=filelist[i];
                            //FSO.DeleteFile(filename,true); // be careful (no confirmation )                            
                            var shell=new ActiveXObject("Shell.Application");
                            var item =shell.Namespace(0).ParseName(filename);
                            item.InvokeVerb("delete");
                        }
                        return HANDLED|CLOSE;
                    //case "zipto":
                    //    return HANDLED|CLOSE;
                }
            }

            return HANDLED;
        },
        showSettings:function() {
            //FARR.debug("showSettings");
            //FARR.exec(this.directory+"\\colorsSettings.ahk");
        }
    }
})();
