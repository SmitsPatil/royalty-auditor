export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    // Handle cases where dateStr might be a full ISO string or just YYYY-MM-DD
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch(e) {
    return dateStr;
  }
};
