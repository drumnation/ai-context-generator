export const vscode = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postMessage: (message: any) => {
    console.log('Message posted to VSCode API:', message);
  },
};
