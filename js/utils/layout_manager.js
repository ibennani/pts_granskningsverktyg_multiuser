/**
 * LayoutManager
 * 
 * Ansvarar för att dynamiskt justera layouten för #app-container.
 * Syftet är att placera innehållet 30% från toppen när det finns plats,
 * men minska marginalen (ner till 0) när innehållet är stort för att undvika onödig scroll.
 */

export const LayoutManager = {
    init() {
        this.appContainer = document.getElementById('app-container');
        this.appWrapper = document.getElementById('app-wrapper');
        this.topBar = document.getElementById('global-action-bar-top');
        this.bottomBar = document.getElementById('global-action-bar-bottom');
        this.buildTimestamp = document.getElementById('build-timestamp');
        this.skipLink = document.getElementById('skip-to-content');

        if (!this.appContainer) {
            console.warn('LayoutManager: #app-container hittades inte.');
            return;
        }

        // Bind metod för event listeners
        this.updateLayout = this.updateLayout.bind(this);

        // Lyssna på window resize
        window.addEventListener('resize', this.updateLayout);

        // Lyssna på DOM-ändringar inuti app-container för att uppdatera när innehåll ändras
        this.resizeObserver = new ResizeObserver(() => {
            this.updateLayout();
        });
        
        // Observera alla barn till app-container för att fånga storleksändringar
        // Vi observerar containern själv också, men ibland triggas inte det av innehållsändringar om den har auto-height
        this.resizeObserver.observe(this.appContainer);

        // Kör en första uppdatering
        // Använd requestAnimationFrame för att säkerställa att DOM är redo
        requestAnimationFrame(this.updateLayout);
    },

    updateLayout() {
        if (!this.appContainer) return;

        const viewportHeight = window.innerHeight;
        const idealMarginTop = viewportHeight * 0.30; // 30% av viewport

        // Beräkna höjden på allt annat som tar plats vertikalt
        // Vi antar att app-container är det som ska flyttas ner
        
        // Hämta faktisk höjd på innehållet i app-container
        // scrollHeight inkluderar padding men inte margin
        const contentHeight = this.appContainer.scrollHeight;
        
        // Hämta höjd på headers/footers
        const topBarHeight = this.topBar ? this.topBar.offsetHeight : 0;
        const bottomBarHeight = this.bottomBar ? this.bottomBar.offsetHeight : 0;
        const timestampHeight = this.buildTimestamp ? this.buildTimestamp.offsetHeight : 0;
        
        // Hämta eventuell padding/margin på wrapper som påverkar
        const wrapperStyle = window.getComputedStyle(this.appWrapper);
        const wrapperPaddingTop = parseFloat(wrapperStyle.paddingTop) || 0;
        const wrapperPaddingBottom = parseFloat(wrapperStyle.paddingBottom) || 0;

        // Total höjd som används av annat än marginalen
        const usedHeight = topBarHeight + contentHeight + bottomBarHeight + timestampHeight + wrapperPaddingTop + wrapperPaddingBottom;
        
        // Hur mycket plats finns kvar?
        const availableSpace = viewportHeight - usedHeight;

        // Vi vill ha marginalen till idealMarginTop, men inte mer än availableSpace (dock minst 0)
        // Om availableSpace är negativt betyder det att innehållet redan är större än viewporten -> margin 0
        
        let targetMarginTop = 0;

        if (availableSpace > 0) {
            // Det finns plats över.
            // Vi vill sätta margin-top så att content hamnar 30% ner, 
            // MEN vi får inte trycka ner det så långt att det skapar scroll om det inte behövs.
            
            // Nuvarande logik i CSS (utan margin):
            // TopBar ligger överst. AppContainer ligger under.
            // Om vi lägger margin-top på AppContainer, flyttas den ner från TopBar.
            
            // Vi vill att (TopBar + Margin) ≈ 30% av Viewport?
            // Eller att AppContainer börjar på 30%? 
            // "den ska vara placerad 30 % från toppen" tolkas oftast som att elementets ovankant är vid 30%.
            
            // Avståndet från toppen till AppContainer (utan extra margin) är ungefär TopBarHeight + WrapperPadding.
            const currentTopPos = topBarHeight + wrapperPaddingTop;
            
            // Vi vill nå idealTopPos = 0.3 * viewportHeight
            const idealTopPos = viewportHeight * 0.30;
            
            // Nödvändig extra margin
            let neededMargin = idealTopPos - currentTopPos;
            
            if (neededMargin < 0) neededMargin = 0;
            
            // Kontrollera att vi inte puttar ut innehållet så att scroll skapas i onödan
            // Max tillåten margin är availableSpace (eftersom availableSpace är (viewport - content - bars))
            // Om vi lägger till mer margin än availableSpace, kommer totalhöjden > viewport -> scroll.
            
            targetMarginTop = Math.min(neededMargin, availableSpace);
        } else {
            // Innehållet är större än viewporten (eller exakt lika), ingen margin ska läggas till
            targetMarginTop = 0;
        }

        // Applicera margin
        this.appContainer.style.marginTop = `${Math.round(targetMarginTop)}px`;
        
        // Lägg till en class för mjuk transition om vi vill ha det via CSS
        // (Vi sätter transition direkt i JS eller förutsätter att det finns i CSS)
        if (!this.appContainer.style.transition) {
            this.appContainer.style.transition = 'margin-top 0.3s ease-out';
        }
    },

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        window.removeEventListener('resize', this.updateLayout);
    }
};
