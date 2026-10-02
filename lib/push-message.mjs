export function pushMessage(body, origin) {
  return {
    web_push:8030,
    notification:{title:'تذكير',body,lang:'ar',dir:'rtl',navigate:origin+'/',silent:false},
    // Keep old installed workers compatible during their update.
    title:'تذكير',body,url:'/',
  };
}
