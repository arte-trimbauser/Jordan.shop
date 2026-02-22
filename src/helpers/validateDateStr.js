module.exports = function validateDateStr(dateStr) {
  if (!dateStr) return false;
  dateStr = dateStr.trim();
  const re1 = /^([0-2]\d|3[01])\/(0\d|1[0-2])\/\d{4}$/;
  const re2 = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
  if (re1.test(dateStr)) {
    const [d,m,y] = dateStr.split("/").map(Number);
    const dt = new Date(y,m-1,d);
    return dt && dt.getFullYear() === y && dt.getMonth() === m-1 && dt.getDate() === d;
  }
  if (re2.test(dateStr)) {
    const [y,m,d] = dateStr.split("-").map(Number);
    const dt = new Date(y,m-1,d);
    return dt && dt.getFullYear() === y && dt.getMonth() === m-1 && dt.getDate() === d;
  }
  return false;
};
