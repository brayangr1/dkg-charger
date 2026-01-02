
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@context/AuthContext';
import { WebSocketProvider } from '@context/WebSocketContext';
import { NotificationProvider } from '@context/NotificationContext';
import { ChargingProvider } from '@context/ChargingContext';
import { ThemeProvider } from '@context/ThemeContext';
import AppRouter from './router/AppRouter';

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <WebSocketProvider>
                        <NotificationProvider>
                            <ChargingProvider>
                                <AppRouter />
                                <Toaster
                                    position="top-right"
                                    toastOptions={{
                                        duration: 4000,
                                        style: {
                                            background: '#363636',
                                            color: '#fff',
                                        },
                                        success: {
                                            duration: 3000,
                                            iconTheme: {
                                                primary: '#4caf50',
                                                secondary: '#fff',
                                            },
                                        },
                                        error: {
                                            duration: 5000,
                                            iconTheme: {
                                                primary: '#f44336',
                                                secondary: '#fff',
                                            },
                                        },
                                    }}
                                />
                            </ChargingProvider>
                        </NotificationProvider>
                    </WebSocketProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
