import { useState } from 'react';
import { useGame } from './GameProvider';
import { Dashboard } from './screens/Dashboard';
import { ElectionScreen } from './screens/ElectionScreen';
import { EndScreen } from './screens/EndScreen';
import { InterviewScreen } from './screens/InterviewScreen';
import { MenuScreen } from './screens/MenuScreen';

export function App() {
  const { jogo } = useGame();
  const [tela, setTela] = useState<'menu' | 'jogo'>('menu');

  if (tela === 'menu' || !jogo) return <MenuScreen onJogar={() => setTela('jogo')} />;
  if (jogo.status === 'fim') return <EndScreen onNovo={() => setTela('menu')} />;
  if (jogo.status === 'eleicao') return <ElectionScreen />;
  if (jogo.entrevista) return <InterviewScreen />;
  return <Dashboard onMenu={() => setTela('menu')} />;
}
