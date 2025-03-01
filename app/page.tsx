'use client';

import React from 'react';
import WebCall from '@/app/components/WebCall';

export default function Home() {
  return (
    <div className='bg-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-8'>
      <h2 className='text-black text-4xl mb-8'>minimal ai call</h2>
      <div className='w-full max-w-4xl'>
        <WebCall />
      </div>
    </div>
  );
}
