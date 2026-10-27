const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JwtService}=require('@nestjs/jwt');
exports.check=async function(app,fixture){
  const {chromium}=require(process.env.LORE_PLAYWRIGHT_MODULE||'playwright');
  const {id,owner,player,secondPlayer,pcId}=fixture;
  await app.listen(3001,'127.0.0.1');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const output=path.resolve('backups/story-browser');fs.mkdirSync(output,{recursive:true});
  const errors=[];
  const jwt=app.get(JwtService);
  async function pageFor(user){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(state=>localStorage.setItem('rpg-auth',JSON.stringify(state)),{state:{token:jwt.sign({sub:user.id,email:user.email}),user:{id:user.id,email:user.email,displayName:user.displayName,avatarUrl:null}},version:0});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://localhost:3100/campaigns/${id}/story`);
    await page.getByRole('heading',{name:'Fatos e rumores',exact:true}).waitFor();return page;
  }
  try{
    const page=await pageFor(owner);
    await page.route('**/story/commands',async route=>{await route.fetch();await route.abort('failed');},{times:1});
    await page.locator('summary').filter({hasText:'Registrar na memória'}).click();
    await page.getByLabel('O que foi confirmado?',{exact:true}).fill('A ponte foi inspecionada pelo grupo no teste do navegador.');
    await page.getByLabel('Quem pode ler',{exact:true}).selectOption('PUBLIC');
    await page.getByRole('button',{name:'Salvar registro',exact:true}).click();
    await page.getByRole('status').filter({hasText:/fetch|network|Failed/i}).waitFor();
    await page.getByRole('button',{name:'Salvar registro',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Registro salvo'}).waitFor();
    await page.getByText('A ponte foi inspecionada pelo grupo no teste do navegador.',{exact:true}).waitFor();
    assert.equal(await page.getByText('A ponte foi inspecionada pelo grupo no teste do navegador.',{exact:true}).count(),1);
    await page.getByLabel('Tipo de registro',{exact:true}).selectOption('DISCOVER');
    const revisionId=await page.getByLabel('Informação a revelar',{exact:true}).locator('option').filter({hasText:/^C05 —/}).getAttribute('value');
    await page.getByLabel('Informação a revelar',{exact:true}).selectOption(revisionId);
    await page.locator(`input[name="knowerIds"][value="${pcId}"]`).check();
    await page.getByLabel('Como soube? (visível ao destinatário)',{exact:true}).fill('O grupo encontrou a ordem de serviço durante a sessão.');
    await page.getByRole('button',{name:'Salvar registro',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Registro salvo'}).waitFor();
    await page.locator('summary').filter({hasText:'Registrar na memória'}).click();
    await page.getByRole('button',{name:'Ver versões de C05',exact:true}).click();
    await page.getByRole('heading',{name:'Versões de C05',exact:true}).waitFor();
    await page.getByRole('button',{name:'Fechar versões'}).click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,'master-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,'master-mobile.png')});
    const playerPage=await pageFor(player);
    assert.equal(await playerPage.locator('summary').filter({hasText:'Registrar na memória'}).count(),0);
    await playerPage.getByText('Origem: O grupo encontrou a ordem de serviço durante a sessão.',{exact:true}).waitFor();
    await playerPage.reload();
    await playerPage.getByText('Origem: O grupo encontrou a ordem de serviço durante a sessão.',{exact:true}).waitFor();
    await playerPage.getByLabel('Buscar nas informações visíveis').fill('Oren');
    await playerPage.getByText('Origem: O grupo encontrou a ordem de serviço durante a sessão.',{exact:true}).waitFor();
    await playerPage.screenshot({path:path.join(output,'player-discovery.png')});
    const second=await pageFor(secondPlayer);
    assert.equal(await second.getByText('Origem: O grupo encontrou a ordem de serviço durante a sessão.',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('OK: browser retries after lost response, note, private discovery, fact history, player isolation/reload and desktop/mobile.');
  }catch(e){
    // Keep browser failures actionable without leaking tokens.
    throw e;
  }finally{await browser.close();}
};
