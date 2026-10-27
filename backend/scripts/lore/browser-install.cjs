const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
exports.checkBrowser=async function(app,db,jwt,owner,player,campaignIds){
  const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');
  await app.listen(3001,'127.0.0.1');
  const browser=await chromium.launch({headless:true,channel:process.env.LORE_BROWSER_CHANNEL||'chrome'});
  const output=path.resolve('backups/lore-migration/browser');fs.mkdirSync(output,{recursive:true});
  const errors=[];
  async function contextFor(user,viewport){
    const context=await browser.newContext({viewport});
    const state={state:{token:jwt.sign({sub:user.id,email:user.email}),user:{id:user.id,email:user.email,displayName:user.displayName,avatarUrl:null}},version:0};
    await context.addInitScript(s=>localStorage.setItem('rpg-auth',JSON.stringify(s)),state);
    return context;
  }
  try{
    const context=await contextFor(owner,{width:1440,height:1000});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3100/campaigns');
    await page.getByRole('button',{name:'Nova campanha',exact:true}).click();
    await page.getByLabel('Nome',{exact:true}).fill('MI-02 — criação pelo navegador');
    await page.getByRole('checkbox',{name:/Usar Eldoria/}).check();
    await page.getByRole('button',{name:'Criar campanha',exact:true}).click();
    await page.waitForURL('**/campaigns/*/lore');
    const campaignId=new URL(page.url()).pathname.split('/')[2];campaignIds.push(campaignId);
    await page.getByText('Cenário instalado para teste',{exact:false}).waitFor();
    await page.waitForFunction(()=>{const images=[...document.querySelectorAll('img[alt^="Mapa de"]')];return images.length===3 && images.every(i=>i.complete && i.naturalWidth>0);});
    await page.screenshot({path:path.join(output,'installed-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.reload();await page.getByRole('heading',{name:'Mapas instalados'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({path:path.join(output,'installed-mobile.png')});
    // Actual VTT rendering must consume the authenticated PNG as a blob, not the external proxy.
    await page.setViewportSize({width:1440,height:1000});
    const badProxy=[];page.on('request',r=>{if(r.url().includes('image-proxy') && decodeURIComponent(r.url()).includes('/lore/maps/'))badProxy.push(r.url());});
    await page.getByRole('link',{name:'Voltar à mesa',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[style]')].some(e=>e.style.backgroundImage.includes('blob:')));
    await page.getByRole('button',{name:'Vista 3D',exact:true}).click();
    await page.locator('canvas').first().waitFor();
    await page.getByRole('button',{name:'Vista 2D',exact:true}).click();
    assert.deepEqual(badProxy,[]);
    await db.campaignMember.create({data:{campaignId,userId:player.id}});
    const character=await db.character.create({data:{userId:player.id,name:'Aventureira do navegador',race:'Humano',class:'Guerreiro'}});
    const playerContext=await contextFor(player,{width:1280,height:900});
    const playerPage=await playerContext.newPage();
    await playerPage.goto(`http://localhost:3100/campaigns/${campaignId}`);
    await playerPage.getByLabel('Seu personagem para esta campanha').selectOption(character.id);
    await playerPage.getByRole('button',{name:'Vincular à campanha'}).click();
    await playerPage.waitForFunction(()=>!document.querySelector('#lore-character'));
    assert.equal(await playerPage.getByRole('link',{name:'Cenário',exact:true}).count(),0);
    await playerPage.goto(`http://localhost:3100/campaigns/${campaignId}/lore`);
    await playerPage.getByRole('alert').filter({hasText:'reservada ao mestre'}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('OK: browser campaign creation, persisted review, 3 authenticated maps, desktop/mobile, VTT 2D/3D, player binding and private review denied.');
  }finally{await browser.close();}
};
