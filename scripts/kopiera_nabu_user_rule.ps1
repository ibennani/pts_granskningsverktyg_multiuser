# Kopierar Nabu user rule-text till urklipp (samma som i nabu-klar-notis.mdc).
$text = @'
I Leffe-projektet (denna arbetskatalog): skicka klar-notis först när hela uppgiften är klar och det avslutande användarsvaret är skrivet. Kör notify_done.cmd som sista och enda verktygsanrop i sista svaret (inte parallellt med annat). I planläge när användaren ska svara: kör notify_question.cmd med kort sammanfattning som sista verktygsanrop (fråge-notis). Webhook kan läsas från .cursor/rules/nabu-webhook.local.mdc. Mer detaljer: .cursor/rules/nabu-klar-notis.mdc, nabu-frage-notis.mdc, 01-nabu-sista-steget.mdc och 02-nabu-frage-notis.mdc
'@.Trim()

Set-Clipboard -Value $text
Write-Host '[kopiera_nabu_user_rule] Text kopierad till urklipp.'
Write-Host 'Klistra in under Cursor Settings > Rules > User Rules (ersatt ev. gammal Nabu-rad).'
