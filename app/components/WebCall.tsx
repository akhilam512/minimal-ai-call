'use client';

import React from 'react';
import { RTVIProvider } from '@/app/context/RTVIContext';
import { RTVIClientAudio } from '@pipecat-ai/client-react';
import WebCallInterfaceMinimal from '@/app/components/WebCallInterfaceMinimal';

const WebCall = () => {
  return (
    <div className='relative'>
      <RTVIProvider>
        <WebCallInterfaceMinimal />
        <RTVIClientAudio />
      </RTVIProvider>
    </div>
  );
};

export default WebCall; 