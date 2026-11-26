interface AboutBingoProps {
    onBack: () => void;
    backLabel: string;
}

export default function AboutBingo({ onBack, backLabel }: AboutBingoProps) {
    return (
        <article className="bingo-about-view" aria-labelledby="bingo-about-heading">
            <header>
                <h1 id="bingo-about-heading">About 54321-BINGO!</h1>
                <p className="bingo-about-tagline">Turn Your TV Into a Bingo Hall!</p>
                <p>
                    54321-BINGO! is a free, browser-based 75-ball Bingo caller designed for
                    parties, family gatherings, and small groups. Print permanent cards,
                    register the cards playing today, call numbers, and let the application
                    identify winning cards automatically.
                </p>
            </header>

            <nav className="bingo-about-contents" aria-label="How-to sections">
                <strong>Quick guide</strong>
                <a href="#bingo-guide-cards">1. Generate and print</a>
                <a href="#bingo-guide-register">2. Register cards</a>
                <a href="#bingo-guide-limits">3. Set winner limit</a>
                <a href="#bingo-guide-calling">4. Call numbers</a>
                <a href="#bingo-guide-winners">5. Announce winners</a>
                <a href="#bingo-guide-next">6. Play another game</a>
                <a href="#bingo-guide-backup">7. Back up and restore cards</a>
            </nav>

            <section id="bingo-guide-cards">
                <h2>1. Generate and print Bingo cards</h2>
                <p>
                    From <strong>Options → Print Bingo Cards</strong>, enter the number of new cards
                    and choose <strong>Generate Cards</strong>. Each card receives its own permanent
                    Card ID (such as A001). Cards are added to your saved library; generating
                    new ones does not replace your existing cards.
                </p>
                <p>
                    Print the preview, or open <strong>Saved Cards</strong> to find and reprint
                    specific cards later. Two cards fit on a US letter-size sheet. Printed cards
                    can be reused in future games. The center square is always FREE.
                </p>
            </section>

            <section id="bingo-guide-register">
                <h2>2. Register the cards that are playing</h2>
                <p>
                    Select <strong>Options → Register Active Cards</strong>. Check the cards
                    participating in this game, search by Card ID, or select a range of IDs.
                    Choose <strong>Save Registration</strong> to confirm your selection.
                    <strong> Printing a card does not register it.</strong> Only registered
                    cards are eligible for automatic winner detection.
                </p>
                <p>
                    Registration can be changed before the first number is called. Once calling
                    begins, setup changes are locked for that game.
                </p>
            </section>

            <section id="bingo-guide-limits">
                <h2>3. Choose whether to limit winners</h2>
                <p>
                    In <strong>Options</strong>, enable <strong>Limit the number of winners</strong>
                    and enter <strong>Maximum winners</strong> if you have a fixed number of prizes.
                    Without a set limit, the host can choose when to end play.
                </p>
                <p>
                    When a limit is set, <strong>Remaining Winners</strong> shows how many more
                    different cards may win, based on the smaller of the configured limit and
                    the number of active cards. A single call can create multiple winners;
                    all cards winning on that same call are recognized, even if their total
                    passes the configured limit.
                </p>
            </section>

            <section id="bingo-guide-calling">
                <h2>4. Call numbers manually or automatically</h2>
                <p>
                    Choose <strong>Call Next Number</strong> for one random, previously uncalled
                    number, or <strong>Start Auto</strong> to call numbers at the selected interval.
                    Use <strong>Pause Auto</strong> and <strong>Resume Auto</strong> as needed.
                    You can turn spoken number announcements and the winner bell on or off.
                </p>
                <p>
                    Green squares mark called numbers; gold highlights the latest call.
                    Opening Options or this guide pauses automatic calling so the host
                    does not miss a number.
                </p>
            </section>

            <section id="bingo-guide-winners">
                <h2>5. Verify and celebrate winning cards</h2>
                <p>
                    The application checks every active card for five marked squares in a
                    horizontal row, vertical column, or diagonal. The FREE center square
                    counts automatically. New winning Card IDs appear in the Winners panel,
                    and automatic calling pauses. A newly winning card flashes when motion
                    effects are enabled; the winner bell sounds when enabled.
                </p>
                <p>
                    A card is announced only once, even if it later completes more winning
                    lines. Several cards can win on one call, and they will all be listed.
                    The host should check the winning physical card against its displayed Card ID.
                </p>
            </section>

            <section id="bingo-guide-next">
                <h2>6. Start another game</h2>
                <p>
                    Select <strong>New Game</strong> to clear the previously called numbers
                    and winners. Your saved cards and active registrations remain available.
                    The game also stops automatically if every registered card has won,
                    the chosen winner limit is reached, or all 75 numbers have been called.
                </p>
            </section>

            <section id="bingo-guide-backup">
                <h2>7. Back up and restore your saved cards</h2>
                <p>
                    Your card library lives in this browser, so clearing cookies and site data,
                    using private browsing, or changing devices may remove the library. To protect
                    your reusable printed cards, open <strong>Options → Backup Cards</strong> and
                    download a JSON backup file. Store it outside the browser, such as in your
                    Documents folder, on a USB drive, or in trusted cloud storage.
                </p>
                <p>
                    To recover the original Card IDs and their exact numbers, open
                    <strong> Options → Restore Cards</strong>, choose that backup file, and confirm.
                    Existing cards are kept; matching cards are skipped, and conflicting IDs
                    stop the entire import without overwriting any card. The numbering sequence
                    is preserved, so newly generated cards don't reuse previously assigned IDs.
                    Restoration is available only before a game starts.
                </p>
                <p>
                    <strong>Important:</strong> Download an updated backup whenever you generate
                    additional cards. A backup cannot recover cards created after that file was
                    downloaded. Without a backup, deleted browser storage usually cannot be recovered.
                    The file does not upload to Hostinger; you keep and control it yourself.
                </p>
            </section>

            <section>
                <h2>Using a TV or projector</h2>
                <p>
                    Display the caller on a computer connected to a television or projector.
                    Press <strong>F11</strong> in most desktop browsers to enter or leave full-screen
                    mode. The Bingo board adjusts to the available height on larger displays;
                    smaller screens may require scrolling.
                </p>
            </section>

            <section>
                <h2>Important: where your cards are saved</h2>
                <p>
                    Saved cards are stored locally in this browser on this device, not in a
                    shared online account. Active-card registrations and some preferences are
                    also stored locally. Called numbers are retained for the current browser
                    tab session. Other browsers, profiles, devices, private-browsing sessions,
                    and website addresses have separate storage.
                </p>
                <p>
                    In particular, cards created while testing on <strong>localhost</strong>
                    do not automatically appear on the published Hostinger website. Generate
                    and keep the cards you intend to use on the live site. Before clearing browser
                    site data, download a card-library backup from Options so your printed cards
                    can be restored later.
                </p>
            </section>

            <section>
                <h2>Frequently asked questions</h2>
                <h3>Can I reprint a card?</h3>
                <p>Yes. Use Saved Cards to find its Card ID and print the original card again.</p>
                <h3>Can a printed card win without being registered?</h3>
                <p>Not through automatic detection. Register each participating Card ID before calling begins.</p>
                <h3>Why did the winner stop flashing?</h3>
                <p>The flashing ends when play resumes. Devices configured to reduce animation display a steady gold highlight instead.</p>
                <h3>Do cards transfer to another device?</h3>
                <p>Not automatically. Download a card-library backup on the old device and restore it on the new one.</p>
            </section>

            <p className="bingo-about-copyright">© 2026 Phillip Galey</p>
            <button type="button" className="bingo-about-back" onClick={onBack}>{backLabel}</button>
            <footer className="bingo-info-footer">
                <nav aria-label="Information links">
                    <a href="https://phillipgaley.com/about">About Phillip Galey</a>
                    <span aria-hidden="true">|</span>
                    <a href="https://phillipgaley.com/contact-us">Contact Us</a>
                    <span aria-hidden="true">|</span>
                    <a href="https://phillipgaley.com/privacy-policy">Privacy Policy</a>
                </nav>
            </footer>
        </article>
    );
}
