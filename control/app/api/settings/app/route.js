import { NextResponse } from 'next/server';
import { AppSettingsRepository, BUILDER_DRIVER_MODES } from '@/lib/db/repositories/appSettings';

export async function GET() {
  return NextResponse.json({
    builderDriverMode: AppSettingsRepository.getBuilderDriverMode(),
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { builderDriverMode } = body || {};
  const valid = Object.values(BUILDER_DRIVER_MODES);
  if (!valid.includes(builderDriverMode)) {
    return NextResponse.json(
      { error: `builderDriverMode must be one of ${valid.join(', ')}` },
      { status: 400 }
    );
  }

  AppSettingsRepository.setBuilderDriverMode(builderDriverMode);
  return NextResponse.json({ builderDriverMode });
}
