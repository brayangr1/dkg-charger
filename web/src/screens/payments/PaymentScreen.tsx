/*import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StripeCheckout } from '../../components/payments/StripeCheckout';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RouteParams = {
  amount: number;
  sessionId: string;
};

export const PaymentScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { amount, sessionId } = route.params as RouteParams;

  const handlePaymentSuccess = () => {
    Alert.alert(
      'Pago Exitoso',
      'Tu pago se ha procesado correctamente',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navegar a la pantalla de recibo/confirmación
            navigation.replace('PaymentSuccess', {
              amount,
              sessionId,
              transactionId: Date.now().toString()
            });
          }
        }
      ]
    );
  };

  const handlePaymentError = (error: string) => {
    Alert.alert('Error en el Pago', error, [
      {
        text: 'OK',
        onPress: () => navigation.goBack()
      }
    ]);
  };

  const handlePaymentCancel = () => {
    Alert.alert(
      'Pago Cancelado',
      '¿Deseas intentar nuevamente?',
      [
        {
          text: 'Sí',
          onPress: () => {
            // Reiniciar el proceso de pago
            navigation.replace('Payment', { amount, sessionId });
          }
        },
        {
          text: 'No',
          onPress: () => navigation.goBack(),
          style: 'cancel'
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StripeCheckout
        amount={amount}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={handlePaymentError}
        onCancel={handlePaymentCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  }
});*/