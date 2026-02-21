export const maskEmail = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0,2)}***@${d}`; };
export const maskPhone = (p: string) => `***-***-${p.slice(-4)}`;
export const formatCurrency = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0}).format(n);
