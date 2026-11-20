import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/marca.dart';

// Se ve solo mientras se restaura la sesión guardada. Mismo fondo que el
// login para que la transición no parpadee.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.tinta,
        body: Stack(
          children: [
            Positioned(left: 0, right: 0, bottom: 0, child: OndasDecorativas(alto: 150)),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  LogoCotizapp(tamano: 88),
                  SizedBox(height: 20),
                  Text(
                    'Cotizapp',
                    style:
                        TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.5),
                  ),
                  SizedBox(height: 32),
                  SizedBox.square(
                    dimension: 24,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
