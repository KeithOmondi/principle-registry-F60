export const calculateFine = (dueDate) => {
  const finePerDay = 5; // Fine of 5 units per day
  const today = new Date();

  if (today > dueDate) {
    const lateDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    return lateDays * finePerDay;
  }

  return 0; // No fine if returned on or before due date
};
