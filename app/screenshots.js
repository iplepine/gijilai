const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const routes = [
    { name: 'home', url: '/' },
    { name: 'login', url: '/login' },
    { name: 'terms', url: '/settings/terms' },
    { name: 'notifications', url: '/settings/notifications' },
    { name: 'record', url: '/record' },
    { name: 'consult', url: '/consult' },
  ];
  
  for (const route of routes) {
    console.log('Taking screenshot of', route.name);
    try {
      await page.goto('http://localhost:3000' + route.url);
      await page.waitForTimeout(2000); 
      await page.screenshot({ path: `/tmp/${route.name}_light.png` });
      
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `/tmp/${route.name}_dark.png` });
      await page.emulateMedia({ colorScheme: 'light' });
    } catch (e) {
      console.log('Failed:', route.name, e.message);
    }
  }
  await browser.close();
  console.log('Done');
})();
