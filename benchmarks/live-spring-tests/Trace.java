import java.util.Locale;
import java.util.Scanner;
import org.rafaelaugusto.jolt.SpringState;

public final class Trace {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in).useLocale(Locale.ROOT);
        while (input.hasNextDouble()) {
            SpringState state = new SpringState(input.nextDouble(), input.nextDouble());
            state.advance(input.nextDouble(), input.nextDouble(), input.nextDouble(),
                          input.nextDouble(), input.nextDouble());
            System.out.printf(Locale.ROOT, "%.17g %.17g%n", state.position, state.velocity);
        }
    }
}
