import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const brands = await prisma.brand.findMany()
  console.log(brands)
}
main()
