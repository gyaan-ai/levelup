/**
 * Calculate age from date of birth
 */
export function ageFromDob(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birthDate.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Calculate days until next birthday
 */
export function daysUntilBirthday(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birthDate.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get this year's birthday
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate()
  );
  thisYearBirthday.setHours(0, 0, 0, 0);
  
  // If birthday has passed this year, get next year's
  if (thisYearBirthday < today) {
    thisYearBirthday.setFullYear(thisYearBirthday.getFullYear() + 1);
  }
  
  const diffTime = thisYearBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Format birthday display with countdown
 * Returns: "Apr 12 (in 18 days)" or "Apr 12 (today!)" or "Apr 12 (tomorrow)"
 */
export function formatBirthdayWithCountdown(dob: string | Date | null | undefined): string | null {
  if (!dob) return null;
  
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  if (isNaN(birthDate.getTime())) return null;
  
  const days = daysUntilBirthday(dob);
  if (days === null) return null;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${monthNames[birthDate.getMonth()]} ${birthDate.getDate()}`;
  
  if (days === 0) {
    return `${formattedDate} (today!)`;
  } else if (days === 1) {
    return `${formattedDate} (tomorrow)`;
  } else {
    return `${formattedDate} (in ${days} days)`;
  }
}

/**
 * Check if birthday is within N days
 */
export function isBirthdaySoon(dob: string | Date | null | undefined, withinDays: number = 7): boolean {
  const days = daysUntilBirthday(dob);
  return days !== null && days <= withinDays;
}
