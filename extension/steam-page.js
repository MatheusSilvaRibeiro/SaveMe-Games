(() => {
  const appId = /^\/app\/([1-9][0-9]*)/.exec(location.pathname)?.[1];
  if (!appId) return;
  SaveMeShow({ title: 'SaveMe Games', message: { type: 'saveme:prices', appId }, automatic: true });
})();
