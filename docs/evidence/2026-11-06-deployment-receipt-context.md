# Existing workflow contract for PR44

Source baseline c91ca4178b85bde8748d0b54b81dde69d3df534d. Original workflow SHA256 `4caa77a305654c2270fb5af119833b777d8da5e3da624d54910429768a50b203`. Engage read the complete workflow from the fetched Git object. The existing deploy job is main-only and is excluded on pull requests. Its existing named step is `id: deploy-vercel`; it emits configured=false on missing secret and configured=true only after successful existing deploy commands. The producer references that exact step in the same job.

Relevant unchanged source:

```yaml
    - name: Deploy to Vercel
      id: deploy-vercel
      if: vars.VERCEL_TOKEN != ''
      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
      run: |
        set -euo pipefail
        if [[ -z "${VERCEL_TOKEN}" ]]; then
          echo "Vercel deployment is not configured; skipping."
          echo "configured=false" >> "${GITHUB_OUTPUT}"
          exit 0
        fi

        npm install --global --no-audit --no-fund vercel@64.4.0
        vercel pull --yes --environment=production --token="${VERCEL_TOKEN}"
        vercel build --prod --token="${VERCEL_TOKEN}"
        vercel deploy --prebuilt --prod --token="${VERCEL_TOKEN}"
        echo "configured=true" >> "${GITHUB_OUTPUT}"

```

The new producer records step conclusion and configured output, not independently observed remote release identity or endpoint health. All existing deploy commands, conditions and credential names remain unchanged. Seven provider-free producer tests pass. No deployment, endpoint request, provider call or runtime acceptance occurred in this qualification. The prior blocked review lacked full workflow context; this records independently checked source evidence, not a replacement PASS.
