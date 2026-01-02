import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import LoadingScreen from '@screens/LoadingScreen';

// Auth screens
const LoginScreen = React.lazy(() => import('@screens/auth/LoginScreen'));
const RegisterScreen = React.lazy(() => import('@screens/auth/RegisterScreen'));
const ForgotPasswordScreen = React.lazy(() => import('@screens/auth/ForgotPasswordScreen'));
const ResetPasswordScreen = React.lazy(() => import('@screens/auth/ResetPasswordScreen'));

// Main screens
const HomeScreen = React.lazy(() => import('@screens/HomeScreen'));

// Charger screens
const ChargerDetailScreen = React.lazy(() => import('@screens/charger/ChargerDetailScreen'));
const ChargerManagementScreen = React.lazy(() => import('@screens/charger/ChargerManagementScreen'));
const ChargerSettingsScreen = React.lazy(() => import('@screens/charger/ChargerSettingsScreen'));
const ChargerHistoryScreen = React.lazy(() => import('@screens/charger/ChargerHistoryScreen'));
const ChargerSchedulingScreen = React.lazy(() => import('@screens/charger/ChargerSchedulingScreen'));
const ChargingScreen = React.lazy(() => import('@screens/charger/ChargingScreen'));
const AddChargerScreen = React.lazy(() => import('@screens/charger/AddChargerScreen'));
const ChargersListScreen = React.lazy(() => import('@screens/charger/ChargersListScreen'));
const HomeChargersScreen = React.lazy(() => import('@screens/charger/HomeChargersScreen'));
const MyChargersScreen = React.lazy(() => import('@screens/charger/MyChargersScreen'));
const ClaimChargerScreen = React.lazy(() => import('@screens/charger/ClaimChargerScreen'));

// ... (inside Routes)


const WalletScreen = React.lazy(() => import('@screens/wallet/WalletScreen'));
const CreateWalletScreen = React.lazy(() => import('@screens/wallet/CreateWalletScreen'));
const AddFundsScreen = React.lazy(() => import('@screens/wallet/AddFundsScreen'));
const TransactionHistoryScreen = React.lazy(() => import('@screens/wallet/TransactionHistoryScreen'));

const PaymentMethodsScreen = React.lazy(() => import('@screens/payment/PaymentMethodsScreen'));
const AddPaymentMethodScreen = React.lazy(() => import('@screens/payment/AddPaymentMethodScreen'));
const PaymentScreen = React.lazy(() => import('@screens/payment/PaymentScreen'));
const PaymentReceiptScreen = React.lazy(() => import('@screens/payment/PaymentReceiptScreen'));
const PaymentSuccessScreen = React.lazy(() => import('@screens/payment/PaymentSuccessScreen'));
const PaymentHistoryScreen = React.lazy(() => import('@screens/payment/PaymentHistoryScreen'));


// Invoices
//const PendingInvoicesScreen = React.lazy(() => import('@screens/invoice/PendingInvoicesScreen'));
//const PendingInvoiceDetailScreen = React.lazy(() => import('@screens/invoice/PendingInvoiceDetailScreen'));

// Support
const TicketScreen = React.lazy(() => import('@screens/support/TicketScreen'));
//const OfflineInvoiceScreen = React.lazy(() => import('@screens/invoice/OfflineInvoiceScreen'));
//const OfflineInvoiceDetailScreen = React.lazy(() => import('@screens/invoice/OfflineInvoiceDetailScreen'));

// Profile & Support
const ProfileScreen = React.lazy(() => import('@screens/profile/ProfileScreen'));
const EditProfileScreen = React.lazy(() => import('@screens/profile/EditProfileScreen'));
const ChangePasswordScreen = React.lazy(() => import('@screens/profile/ChangePasswordScreen'));
const BillingDetailsScreen = React.lazy(() => import('@screens/profile/BillingDetailsScreen'));

const SupportScreen = React.lazy(() => import('@screens/SupportScreen'));
const FAQScreen = React.lazy(() => import('@screens/support/FAQScreen'));
const ContactScreen = React.lazy(() => import('@screens/support/ContactScreen'));

// Invitations
const InviteUsersScreen = React.lazy(() => import('@screens/invitations/InviteUsersScreen'));
const AcceptInvitationScreen = React.lazy(() => import('@screens/invitations/AcceptInvitationScreen'));
const GuestManagementScreen = React.lazy(() => import('@screens/invitations/GuestManagementScreen'));

const AppRouter: React.FC = () => {
    const { user, isAuthChecked, loading } = useAuth();

    if (!isAuthChecked || loading) {
        return <LoadingScreen />;
    }

    return (
        <React.Suspense fallback={<LoadingScreen />}>
            <Routes>
                {user ? (
                    // Authenticated routes
                    <>
                        <Route path="/" element={<HomeScreen />} />

                        {/* Charger routes */}
                        <Route path="/chargers" element={<ChargersListScreen />} />
                        <Route path="/chargers/mine" element={<MyChargersScreen />} />
                        <Route path="/home-chargers" element={<HomeChargersScreen />} />
                        <Route path="/chargers/claim" element={!user.isGuest ? <ClaimChargerScreen /> : <Navigate to="/" />} />
                        <Route path="/chargers/add" element={!user.isGuest ? <AddChargerScreen /> : <Navigate to="/" />} />
                        <Route path="/chargers/:chargerId" element={<ChargerDetailScreen />} />
                        <Route path="/chargers/:chargerId/manage" element={<ChargerManagementScreen />} />
                        <Route path="/chargers/:chargerId/settings" element={<ChargerSettingsScreen />} />
                        <Route path="/chargers/:chargerId/history" element={<ChargerHistoryScreen />} />
                        <Route path="/chargers/:chargerId/scheduling" element={<ChargerSchedulingScreen />} />
                        <Route path="/charging/:chargerId" element={<ChargingScreen />} />

                        {/* Wallet & Payments */}
                        <Route path="/wallet" element={<WalletScreen />} />
                        <Route path="/wallet/create" element={<CreateWalletScreen />} />
                        <Route path="/wallet/add-funds" element={<AddFundsScreen />} />
                        <Route path="/wallet/transactions" element={<TransactionHistoryScreen />} />

                        <Route path="/payments/methods" element={<PaymentMethodsScreen />} />
                        <Route path="/payments/methods/add" element={<AddPaymentMethodScreen />} />
                        <Route path="/payment/process" element={<PaymentScreen />} />
                        <Route path="/payment/receipt/:paymentId" element={<PaymentReceiptScreen />} />
                        <Route path="/payment/success" element={<PaymentSuccessScreen />} />
                        <Route path="/payments/history" element={<PaymentHistoryScreen />} />
                        <Route path="/payments" element={<PaymentScreen />} />"

                        {/* Invoices 
                        <Route path="/invoices/pending" element={<PendingInvoicesScreen />} />
                        <Route path="/invoices/pending/:invoiceId" element={<PendingInvoiceDetailScreen />} />
                        <Route path="/invoices/offline" element={<OfflineInvoiceScreen />} />
                        <Route path="/invoices/offline/:invoiceId" element={<OfflineInvoiceDetailScreen />} />*/}

                        {/* Profile & Support */}
                        <Route path="/profile" element={<ProfileScreen />} />
                        <Route path="/profile/edit" element={<EditProfileScreen />} />
                        <Route path="/profile/password" element={<ChangePasswordScreen />} />
                        <Route path="/profile/billing" element={<BillingDetailsScreen />} />

                        <Route path="/support" element={<SupportScreen />} />
                        <Route path="/support/faq" element={<FAQScreen />} />
                        <Route path="/support/contact" element={<ContactScreen />} />
                        <Route path="/support/ticket" element={<TicketScreen />} />

                        {/* Invitations */}
                        <Route path="/invitations/invite" element={!user.isGuest ? <InviteUsersScreen /> : <Navigate to="/" />} />
                        <Route path="/invitations/manage" element={!user.isGuest ? <GuestManagementScreen /> : <Navigate to="/" />} />

                        {/*<Route path="/map" element={<PublicMapScreen />} />*/}

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                ) : (
                    // Public routes
                    <>
                        <Route path="/login" element={<LoginScreen />} />
                        <Route path="/register" element={<RegisterScreen />} />
                        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
                        <Route path="/reset-password" element={<ResetPasswordScreen />} />

                        {/* Invitations Public Route */}
                        <Route path="/invitations/accept" element={<AcceptInvitationScreen />} />

                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </>
                )}
            </Routes>
        </React.Suspense>
    );
};

export default AppRouter;
