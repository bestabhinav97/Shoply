let openDialogs = 0;
let previousOverflow = '';

// Nested dialogs must keep the page locked until the last dialog closes.
export function lockDialogScroll() {
  if (openDialogs === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openDialogs += 1;
  return () => {
    openDialogs -= 1;
    if (openDialogs === 0) document.body.style.overflow = previousOverflow;
  };
}
