import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await prisma.searchHistory.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ message: 'History cleared', deleted: result.count });
  } catch (error) {
    console.error('History clear error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
