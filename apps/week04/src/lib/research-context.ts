let selected=localStorage.getItem('week04-selected-item')||'';
export const selectedItem=()=>selected;
export function selectItem(id:string){if(id===selected)return;selected=id;localStorage.setItem('week04-selected-item',id);window.dispatchEvent(new CustomEvent('research-selection',{detail:id}));}
