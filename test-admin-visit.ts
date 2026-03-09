import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  try {
    const visits = await prisma.adminVisit.findMany({ take: 1 })
    console.log("Success:", visits)
  } catch(e) {
    console.error("Error:", e)
  } finally {
    await prisma.$disconnect()
  }
}
main()
