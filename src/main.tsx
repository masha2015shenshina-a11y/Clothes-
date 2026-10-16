import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './styles.css';
class AppBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){console.error(error);window.dispatchEvent(new CustomEvent('cloth-failed',{detail:'НЕ УДАЛОСЬ ОТКРЫТЬ СЦЕНУ'}));}
  render(){return this.state.failed?null:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<AppBoundary><App/></AppBoundary>);
