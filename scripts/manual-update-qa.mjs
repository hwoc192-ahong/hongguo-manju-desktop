// Tests download consent using an isolated packaged app and a harmless fixture.
// Never installs the fixture or modifies the user's installed application.
import {_electron as electron} from 'playwright-core';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory=path.resolve('outputs/manual-update-client/win-unpacked');
const configFile=path.join(directory,'resources/app-update.yml');
const original=await readFile(configFile).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
const output=path.resolve(`outputs/manual-update-qa-${Date.now()}`);await mkdir(output,{recursive:true});
const {version}=JSON.parse(await readFile('package.json','utf8'));
const nextVersion=version.replace(/\d+$/,value=>String(Number(value)+1));
const fixture=Buffer.from('Harmless update consent QA fixture. Never execute.');
const sha512=createHash('sha512').update(fixture).digest('base64');
const manifest=`version: ${nextVersion}\nfiles:\n  - url: consent-fixture.exe\n    sha512: ${sha512}\n    size: ${fixture.length}\npath: consent-fixture.exe\nsha512: ${sha512}\n`;
const requests=[];let app;const errors=[];const events=[];
const server=createServer((request,response)=>{
 requests.push(request.url);
 if(request.url.startsWith('/latest.yml')){response.end(manifest);return;}
 if(request.url==='/consent-fixture.exe'){response.end(fixture);return;}
 response.writeHead(404);response.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const downloads=()=>requests.filter(value=>value==='/consent-fixture.exe').length;
const launch=()=>electron.launch({executablePath:path.join(directory,'红果漫剧桌面版.exe'),env:{...process.env,HONGGUO_TEST_DATA:path.join(output,'profile')}});
const observe=async()=>{app=await launch();const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));return page;};
try{
 await writeFile(configFile,`provider: generic\nurl: ${url}\nupdaterCacheDirName: manual-consent-qa-${Date.now()}\n`);
 let page=await observe();
 await page.getByRole('button',{name:'立即更新',exact:true}).waitFor({timeout:30000});
 assert.equal(downloads(),0);assert.equal((await page.evaluate(()=>window.desktop.updateState())).data.status,'available');
 events.push('startup check prompts without requesting installer');
 await page.screenshot({path:path.join(output,'available.png')});
 await page.getByRole('button',{name:'暂不更新',exact:true}).click();
 assert.equal(await page.locator('.update-panel').count(),0);
 await page.getByRole('button',{name:'我的收藏',exact:true}).click();
 await page.waitForTimeout(1500);assert.equal(downloads(),0);
 await page.getByRole('button',{name:'应用更新',exact:true}).click();
 await page.getByRole('button',{name:'立即更新',exact:true}).waitFor();assert.equal(downloads(),0);
 events.push('declining and reopening panel do not download');
 await app.close();app=undefined;
 page=await observe();await page.getByRole('button',{name:'立即更新',exact:true}).waitFor({timeout:30000});assert.equal(downloads(),0);
 events.push('restart checks again without downloading');
 await page.getByRole('button',{name:'立即更新',exact:true}).click();
 await page.getByRole('button',{name:'重启安装',exact:true}).waitFor({timeout:30000});
 assert.equal(downloads(),1);assert.equal((await page.evaluate(()=>window.desktop.updateState())).data.status,'downloaded');
 assert.equal(await app.evaluate(({app})=>app.getVersion()),version);
 events.push('explicit click downloads once; verified fixture waits for install confirmation');
 await page.screenshot({path:path.join(output,'downloaded.png')});assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'report.json'),JSON.stringify({passed:true,version,events,requests,errors,fixtureOnly:true},null,2));
 console.log(JSON.stringify({passed:true,version,events,requests,output},null,2));
}finally{
 if(app)await app.close();if(original)await writeFile(configFile,original);else await unlink(configFile);server.closeAllConnections();server.close();
}
