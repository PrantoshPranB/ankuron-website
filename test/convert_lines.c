/* Reads lines from stdin and prints each one converted by the C engine;
 * used by parity.mjs to check website/js/engine.js against core/. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../../core/transliterator.h"

int main(void) {
    char line[4096];
    while (fgets(line, sizeof line, stdin)) {
        line[strcspn(line, "\n")] = 0;
        char *out = axom_convert(line);
        if (!out) return 1;
        printf("%s\n", out);
        free(out);
    }
    return 0;
}
