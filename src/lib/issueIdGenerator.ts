import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generates a unique 7-character alphanumeric ID for issues
 * Format: 3 letters + 4 numbers (e.g., ABC1234)
 */
export async function generateUniqueIssueId(): Promise<string> {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 3 random uppercase letters
    const letters = Array.from({ length: 3 }, () => 
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    ).join('');
    
    // Generate 4 random digits
    const numbers = Array.from({ length: 4 }, () => 
      Math.floor(Math.random() * 10)
    ).join('');
    
    const issueId = letters + numbers;
    
    // Check if this ID already exists
    const existingIssue = await prisma.issue.findUnique({
      where: { id: issueId }
    });
    
    if (!existingIssue) {
      return issueId;
    }
  }
  
  // Fallback: use timestamp-based ID if all attempts failed
  const timestamp = Date.now().toString().slice(-4);
  const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const randomLetters = Array.from({ length: 2 }, () => 
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  
  return randomLetter + randomLetters + timestamp;
}
