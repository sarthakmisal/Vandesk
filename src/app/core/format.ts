/** All money in the app is integer paise. */
export const money = (paise: number): string => '₹' + (paise / 100).toLocaleString('en-IN');
